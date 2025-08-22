import * as fs from "node:fs";
import * as path from "node:path";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type {
  AssistantMessageType,
  ToVscodeMessage,
  ToolCallMessageType,
  UserMessageType,
  VscodeChatDelta,
  VscodeChatError,
  VscodeChatFinish,
  VscodeChatStart,
  VscodeEnvResponse,
  VscodeFakeMessage,
  VscodeToolCallResult,
} from "@vscode-tools/protocol";
import { CREATE_FILE, CREATE_FILE_DESCRIPTION, CREATE_FILE_SCHEMA } from "@vscode-tools/protocol";
import {
  type AssistantContent,
  type ModelMessage,
  ToolModelMessage,
  type ToolResultPart,
  UserModelMessage,
  streamText,
} from "ai";
import * as vscode from "vscode";
import { TreeContextProvider } from "./context/tree-context-provider";

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
          await webviewView.webview.postMessage({
            to: "webview",
            command: "env",
            payload: { key, value },
          } as VscodeEnvResponse);
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
              to: "webview",
              command: "tool-call-result",
              payload: { id, name, result: `${result}` },
            } as VscodeToolCallResult);
          } catch (e) {
            await webviewView.webview.postMessage({
              to: "webview",
              command: "chat.error",
              payload: String(e),
            } as VscodeChatError);
          }
          break;
        }

        default:
          console.warn("Unknown command from webview:", command);
      }
    });
  }

  private async startAIStream(_messages: (UserMessageType | AssistantMessageType | ToolCallMessageType)[]) {
    try {
      const config = vscode.workspace.getConfiguration("vscode-tools");
      const apiKey = config.get<string>("apiKey");

      if (!apiKey) {
        throw new Error("API key not configured");
      }

      this._controller = new AbortController();
      const contextSuffix = await this.buildContextSuffix();
      const messages: ModelMessage[] = [];

      for (const msg of _messages) {
        switch (msg.role) {
          case "assistant": {
            messages.push({
              role: msg.role,
              content: [
                ...(msg.reasoning ? [{ type: "reasoning" as const, text: msg.reasoning }] : []),
                ...(msg.content ? [{ type: "text" as const, text: msg.content }] : []),
                ...(msg.toolcall
                  ? Object.entries(msg.toolcall).map(([id, value]) => ({
                      type: "tool-call" as const,
                      toolCallId: id,
                      toolName: value.name,
                      input: value.args,
                    }))
                  : []),
              ] as AssistantContent,
            });
            break;
          }
          case "tool-call": {
            const last = messages.at(-1);
            const part: ToolResultPart = {
              toolCallId: msg.id,
              toolName: msg.name,
              output: { type: "text", value: msg.result ? `${msg.result}` : "" },
              type: "tool-result",
            };
            if (last && last.role === "tool") {
              last.content.push(part);
            } else {
              messages.push({ role: "tool", content: [part] });
            }
            break;
          }
          case "user": {
            messages.push(msg);
            break;
          }
        }
      }

      const client = streamText({
        model: createDeepSeek({
          apiKey: apiKey,
        })("deepseek-chat"),
        messages: [
          ...(contextSuffix
            ? [
                {
                  role: "system" as const,
                  content: contextSuffix,
                },
              ]
            : []),
          ...messages,
        ],
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
              to: "webview",
              command: "chat.delta",
              payload: {
                type: "tool-call",
                id: event.chunk.toolCallId,
                name: event.chunk.toolName,
                args: JSON.stringify(event.chunk.input),
              },
            } as VscodeChatDelta);
          } else if (event.chunk.type === "text-delta" || event.chunk.type === "reasoning-delta") {
            await this._webviewView?.webview.postMessage({
              to: "webview",
              command: "chat.delta",
              payload: {
                type: event.chunk.type,
                text: event.chunk.text,
              },
            } as VscodeChatDelta);
          } else if (event.chunk.type === "tool-input-start" || event.chunk.type === "tool-input-delta") {
            await this._webviewView?.webview.postMessage({
              to: "webview",
              command: "chat.delta",
              payload: {
                type: "tool-call-delta",
                id: event.chunk.id,
                name: "toolName" in event.chunk ? event.chunk.toolName : undefined,
                args: "delta" in event.chunk ? JSON.stringify(event.chunk.delta) : undefined,
              },
            } as VscodeChatDelta);
          }
        },
        onFinish: async () => {
          await this._webviewView?.webview.postMessage({ to: "webview", command: "chat.finish" } as VscodeChatFinish);
        },
        onError: async (error) => {
          await this._webviewView?.webview.postMessage({
            to: "webview",
            command: "chat.error",
            payload: String(error),
          } as VscodeChatError);
        },
      });

      // 等待流开始
      for await (const part of client.fullStream) {
        if (part.type === "start") {
          await this._webviewView?.webview.postMessage({
            to: "webview",
            command: "chat.start",
          } as VscodeChatStart);
        }
      }
    } catch (error) {
      console.error("AI stream error:", error);
      await this._webviewView?.webview.postMessage({
        to: "webview",
        command: "chat.error",
        payload: String(error),
      } as VscodeChatError);
    }
  }

  private async buildContextSuffix(): Promise<string | undefined> {
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) return undefined;
      const root = folders[0].uri.fsPath;
      const projectName = path.basename(root);

      const treeProvider = new TreeContextProvider();
      const items = await treeProvider.contexts({});
      const treeBlock = items[0]?.content ?? "";

      const suffix = [
        "\n\n[context]",
        `project name: ${projectName}`,
        `workspace: ${root}`,
        "file tree:",
        treeBlock,
      ].join("\n");
      return suffix;
    } catch {
      return undefined;
    }
  }

  public async generateUnitTest(prompt: string): Promise<void> {
    try {
      const messages: (UserMessageType | AssistantMessageType | ToolCallMessageType)[] = [
        {
          role: "user",
          content: prompt,
        },
      ];
      await this.startAIStream(messages);
    } catch (error) {
      console.error("GenerateUnitTest error:", error);
      vscode.window.showErrorMessage(`生成单元测试失败: ${error}`);
    }
  }

  public async sendFakeMessage(message: string): Promise<void> {
    try {
      if (this._webviewView) {
        await this._webviewView.webview.postMessage({
          to: "webview",
          command: "fake-message",
          payload: message,
        } as VscodeFakeMessage);
      }
    } catch (error) {
      console.error("Failed to send fake message:", error);
    }
  }
}
