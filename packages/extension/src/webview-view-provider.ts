import * as fs from "node:fs";
import * as path from "node:path";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type {
  AssistantMessageType,
  ToVscodeMessage,
  ToolCallMessageType,
  UserMessageType,
  VscodeToolCallResponse,
} from "@vscode-tools/protocol";
import { CREATE_FILE, CREATE_FILE_DESCRIPTION, CREATE_FILE_SCHEMA } from "@vscode-tools/protocol";
import { type AssistantContent, type ModelMessage, streamText } from "ai";
import * as vscode from "vscode";

export class VSCodeToolsViewProvider implements vscode.WebviewViewProvider {
  private _context: vscode.ExtensionContext;
  private _webviewView: vscode.WebviewView | undefined;
  private _chatStatus: "ready" | "reasoning" | "streaming" = "ready";
  private _currentMessageIndex = -1;
  private _messages: Array<UserMessageType | AssistantMessageType | ToolCallMessageType> = [];
  private _controller: AbortController | undefined;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Thenable<void> | void {
    this._webviewView = webviewView;
    const webviewUiDir = vscode.Uri.joinPath(this._context.extensionUri, "dist", "webview-ui");

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewUiDir],
    };

    try {
      const manifest: { allFiles: string[] } = JSON.parse(
        fs.readFileSync(path.join(webviewUiDir.fsPath, "manifest.json"), "utf8"),
      );
      let content = fs.readFileSync(path.join(webviewUiDir.fsPath, "index.html"), "utf8");

      for (const file of manifest.allFiles) {
        content = content.replace(file, `${webviewView.webview.asWebviewUri(vscode.Uri.joinPath(webviewUiDir, file))}`);
      }

      webviewView.webview.html = content;
    } catch (error) {
      console.error("Error loading webview content:", error);
      webviewView.webview.html = `<p>${error}</p>`;
    }

    webviewView.webview.onDidReceiveMessage(async (message: ToVscodeMessage) => {
      const { command, payload } = message;
      console.debug("VSCode Listener Received message:", command, payload);

      switch (command) {
        case "env": {
          console.log("env:", payload);
          const key = String(payload || "");
          const config = vscode.workspace.getConfiguration("vscode-tools");
          const value = config.get<string>(key);
          console.log("env:", key, value);
          await webviewView.webview.postMessage({ command: "env", payload: { key, value } });
          break;
        }

        case "chat.start": {
          console.log("chat.start triggered with messages:", payload);
          if (this._chatStatus !== "ready") {
            console.warn("chat.start ignored: streaming already in progress");
            break;
          }
          this._chatStatus = "streaming";
          this._messages = payload || [];
          this._currentMessageIndex = this._messages.length;
          this._messages.push({ role: "assistant" });
          await this.startAIStream();
          break;
        }

        case "chat.abort": {
          console.log("chat.abort triggered");
          this._chatStatus = "ready";
          this._currentMessageIndex = -1;
          this._controller?.abort();
          break;
        }

        case "tool-call": {
          try {
            const { id, name, args } = payload;
            console.log("toolcall:", id, name, args);
            if (!id || !name) throw new Error("Invalid toolcall payload");
            const { callTool } = await import("./tools/callTool");
            const result = await callTool(name, args);
            console.log("toolcall result:", result);
            await webviewView.webview.postMessage({
              command: "tool-call",
              payload: { id, name, result: `${result}` },
            } as VscodeToolCallResponse);
          } catch (e) {
            await webviewView.webview.postMessage({ command: "chat.error", payload: String(e) });
          }
          break;
        }

        default:
          console.warn("Unknown command from webview:", command);
      }
    });
  }

  private async startAIStream() {
    try {
      const config = vscode.workspace.getConfiguration("vscode-tools");
      const apiKey = config.get<string>("apiKey");

      if (!apiKey) {
        throw new Error("API key not configured");
      }

      this._controller = new AbortController();

      const client = streamText({
        model: createDeepSeek({
          apiKey: apiKey,
        })("deepseek-chat"),
        messages: this._messages
          .map((m): ModelMessage | undefined => {
            if (m.role === "assistant") {
              return {
                role: m.role,
                content: [
                  ...(m.reasoning ? [{ type: "reasoning" as const, text: m.reasoning }] : []),
                  ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
                  ...(m.toolcall
                    ? Object.entries(m.toolcall).map(([id, value]) => ({
                        type: "tool-call" as const,
                        toolCallId: id,
                        toolName: value.name,
                        input: value.args,
                      }))
                    : []),
                ] as AssistantContent,
              };
            }
            if (m.role === "user") {
              return m as ModelMessage;
            }
            return undefined;
          })
          .filter((m): m is ModelMessage => m !== undefined),
        tools: {
          [`${CREATE_FILE}`]: {
            description: CREATE_FILE_DESCRIPTION,
            inputSchema: CREATE_FILE_SCHEMA,
          },
        },
        abortSignal: this._controller.signal,
        onChunk: async (event) => {
          const curr = this._messages[this._currentMessageIndex];
          if (curr?.role === "assistant") {
            switch (event.chunk.type) {
              case "reasoning-delta": {
                curr.reasoning = (curr.reasoning || "") + event.chunk.text;
                break;
              }
              case "text-delta": {
                curr.content = (curr.content || "") + event.chunk.text;
                break;
              }
              case "tool-call": {
                curr.toolcall = {
                  [event.chunk.toolCallId]: {
                    name: event.chunk.toolName,
                    args: JSON.stringify(event.chunk.input),
                  },
                };
                break;
              }
            }
            // 规范化发送给前端的 payload，符合协议字段
            if (event.chunk.type === "tool-call") {
              await this._webviewView?.webview.postMessage({
                command: "chat.delta",
                payload: {
                  type: "tool-call",
                  id: event.chunk.toolCallId,
                  name: event.chunk.toolName,
                  args: JSON.stringify(event.chunk.input),
                },
              });
            } else if (event.chunk.type === "text-delta" || event.chunk.type === "reasoning-delta") {
              await this._webviewView?.webview.postMessage({
                command: "chat.delta",
                payload: {
                  type: event.chunk.type,
                  text: event.chunk.text,
                },
              });
            }
          }
        },
        onFinish: async () => {
          this._chatStatus = "ready";
          this._currentMessageIndex = -1;
          await this._webviewView?.webview.postMessage({ command: "chat.finish" });
        },
        onError: async (error) => {
          this._chatStatus = "ready";
          this._currentMessageIndex = -1;
          await this._webviewView?.webview.postMessage({
            command: "chat.error",
            payload: String(error),
          });
        },
      });

      // 等待流开始
      for await (const part of client.fullStream) {
        if (part.type === "start") {
          break;
        }
      }
    } catch (error) {
      console.error("AI stream error:", error);
      this._chatStatus = "ready";
      this._currentMessageIndex = -1;
      await this._webviewView?.webview.postMessage({
        command: "chat.error",
        payload: String(error),
      });
    }
  }
}
