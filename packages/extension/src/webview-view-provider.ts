import { CancellationToken, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from "vscode";

export class VSCodeToolsViewProvider implements WebviewViewProvider {
  private _view?: WebviewView;

  constructor() {
    console.log("VSCodeToolsViewProvider constructor called");
  }
  
  public resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken): Thenable<void> | void {
    console.log("VSCodeToolsViewProvider.resolveWebviewView called");
    
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: []
    };

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'hello':
            window.showInformationMessage('Hello from VSCode Tools!');
            return;
          case 'info':
            window.showInformationMessage('This is the VSCode Tools extension!');
            return;
        }
      }
    );

  }
  
  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VSCode Tools</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: 20px;
            }
            .container {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .tool-button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 10px 15px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            .tool-button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h3>VSCode Tools</h3>
            <button class="tool-button" onclick="sendMessage('hello')">Say Hello</button>
            <button class="tool-button" onclick="sendMessage('info')">Show Info</button>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            function sendMessage(command) {
                vscode.postMessage({
                    command: command
                });
            }
        </script>
    </body>
    </html>`;
  }
}