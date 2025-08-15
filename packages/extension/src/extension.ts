import { type ExtensionContext, commands, window } from "vscode";
import { VSCodeToolsViewProvider } from "./webview-view-provider";
import { callBuiltInTool } from "./tools/callTool";
import { BuiltInToolNames } from "./tools/types";
import { VsCodeIde } from "./tools/vsCodeIde";

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "vscode-tools" is now active!');

  context.subscriptions.push(
    commands.registerCommand("vscode-tools.helloWorld", () => {
      window.showInformationMessage("Hello World from vscode-tools!");
    }),

    window.registerWebviewViewProvider("vscode-tools.view", new VSCodeToolsViewProvider(context)),

    commands.registerCommand("vscode-tools.createNewFile", async () => {
      try {
        const args = {
          filepath: "tmp/created-by-tool.txt",
          contents: "Hello from vscode-tools test command\n",
        };
        const items = await callBuiltInTool(BuiltInToolNames.CreateNewFile, args);
        const msg = items?.[0]?.description || "File created";
        window.showInformationMessage(`CreateNewFile: ${msg}`);
      } catch (err) {
        console.error("CreateNewFile command failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        console.error("Error message:", message);
        window.showErrorMessage(`CreateNewFile failed: ${message}`);
      }
    }),

    commands.registerCommand("vscode-tools.readFile", async () => {
      try {
        const args = {
          filepath: "tmp/created-by-tool.txt",
        };
        const items = await callBuiltInTool(BuiltInToolNames.ReadFile, args);
        const contentPreview = items?.[0]?.content ?? "";
        window.showInformationMessage(`ReadFile ok, length=${contentPreview.length}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        window.showErrorMessage(`ReadFile failed: ${message}`);
      }
    }),
  );
}

export function deactivate() {}
