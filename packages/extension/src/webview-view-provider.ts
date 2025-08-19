import * as fs from "node:fs";
import * as path from "node:path";
import { TextDecoder } from "node:util";
import * as vscode from "vscode";

export class VSCodeToolsViewProvider implements vscode.WebviewViewProvider {
  private _context: vscode.ExtensionContext;
  private _chatController?: AbortController;

  private getConfigValue(key: "baseURL" | "thinkTag" | "apiKey") {
    const config = vscode.workspace.getConfiguration("vscode-tools");
    switch (key) {
      case "baseURL":
        return config.get<string>("baseURL", "http://localhost:8098");
      case "thinkTag":
        return config.get<boolean>("thinkTag", true);
      case "apiKey":
        return config.get<string>("apiKey", "");
    }
  }

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Thenable<void> | void {
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

    webviewView.webview.onDidReceiveMessage(async (message) => {
      console.log("received message:", message);
      try {
        const { command, payload } = message as { command: string; payload?: any };
        switch (command) {
          case "env": {
            const key = String(payload || "");
            if (key === "baseURL" || key === "thinkTag" || key === "apiKey") {
              const value = this.getConfigValue(key);
              await webviewView.webview.postMessage({ command: "env", payload: { key, value } });
            }
            break;
          }

          case "chat.invoke": {
            if (this._chatController) {
              this._chatController.abort();
            }

            const baseURL = this.getConfigValue("baseURL") as string;
            const prompt: string = String(payload ?? "");
            this._chatController = new AbortController();

            try {
              const response = await fetch(`${baseURL}/getStreamChat`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "text/event-stream",
                },
                body: JSON.stringify({ prompt }),
                signal: this._chatController.signal,
              });

              if (!response.ok || !response.body) {
                throw new Error(`Upstream response not ok: ${response.status}`);
              }

              const reader = (response.body as any).getReader();
              const decoder = new TextDecoder();
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split("\n\n");
                buffer = events.pop() || "";
                for (const evt of events) {
                  const lines = evt.split("\n");
                  for (const line of lines) {
                    if (line.startsWith("data:")) {
                      const data = line.slice(5).trim();
                      if (!data) continue;
                      const chunk = data.replace(/<\|enter\|>/g, "\n");
                      await webviewView.webview.postMessage({
                        command: "chat.delta",
                        payload: { type: "text", buffer: chunk },
                      });
                    }
                  }
                }
              }

              await webviewView.webview.postMessage({ command: "chat.finish" });
            } catch (err: any) {
              if (err?.name === "AbortError") {
                // cancelled by user
              } else {
                await webviewView.webview.postMessage({ command: "chat.error", payload: String(err) });
              }
            } finally {
              this._chatController = undefined;
            }
            break;
          }

          case "chat.cancel": {
            if (this._chatController) {
              this._chatController.abort();
              this._chatController = undefined;
            }
            break;
          }

          case "toolcall": {
            try {
              const { id, name, args } = payload || {};
              if (!id || !name) throw new Error("Invalid toolcall payload");
              const { callTool } = await import("./tools/callTool");
              const result = await callTool(String(name), args || {});
              await webviewView.webview.postMessage({ command: "toolcall", payload: { id, result } });
            } catch (e) {
              await webviewView.webview.postMessage({ command: "chat.error", payload: String(e) });
            }
            break;
          }

          default:
            console.warn("Unknown command from webview:", command);
        }
      } catch (error) {
        console.error("Failed handling message from webview:", error);
      }
    });
  }
}
