import * as fs from "node:fs";
import * as path from "node:path";
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

    webviewView.webview.onDidReceiveMessage(async (message) => {
      console.log("Received message from webview:", message);
    });
  }
}
