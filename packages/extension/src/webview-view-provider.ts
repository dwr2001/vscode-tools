import * as fs from "node:fs";
import * as path from "node:path";
import type { ToVscodeMessage, VscodeToolCallResponse } from "@vscode-tools/protocol";
import * as vscode from "vscode";

export class VSCodeToolsViewProvider implements vscode.WebviewViewProvider {
  private _context: vscode.ExtensionContext;

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

        case "tool-call": {
          try {
            const { id, name, args } = payload;
            console.log("toolcall:", id, name, args);
            if (!id || !name) throw new Error("Invalid toolcall payload");
            const { callTool } = await import("./tools/callTool");
            const result = await callTool(name, args);
            await webviewView.webview.postMessage({ command: "tool-call", payload: { id, name, result: `${result}` } } as VscodeToolCallResponse);
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
}
