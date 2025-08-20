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

        case "chat.init": {
          console.log("chat.init triggered with messages:", payload);
          await this.startAIStream(payload);
          break;
        }

        case "chat.abort": {
          console.log("chat.abort triggered");
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

  private async startAIStream(messages: (UserMessageType | AssistantMessageType | ToolCallMessageType)[]) {
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
        messages: messages
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
        },
        onFinish: async () => {
          await this._webviewView?.webview.postMessage({ command: "chat.finish" });
        },
        onError: async (error) => {
          await this._webviewView?.webview.postMessage({
            command: "chat.error",
            payload: String(error),
          });
        },
      });

      // 等待流开始
      for await (const part of client.fullStream) {
        if (part.type === "start") {
          await this._webviewView?.webview.postMessage({
            command: "chat.start",
          });
        }
      }
    } catch (error) {
      console.error("AI stream error:", error);
      await this._webviewView?.webview.postMessage({
        command: "chat.error",
        payload: String(error),
      });
    }
  }
}
