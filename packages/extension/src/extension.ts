import { type ExtensionContext, commands, window } from "vscode";
import { TreeContextProvider } from "./context/tree-context-provider";
import { callTool } from "./tools/callTool";
import { VSCodeToolsViewProvider } from "./webview-view-provider";

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "vscode-tools" is now active!');

  context.subscriptions.push(
    commands.registerCommand("vscode-tools.helloWorld", () => {
      window.showInformationMessage("Hello World from vscode-tools!");
    }),

    window.registerWebviewViewProvider("vscode-tools.view", new VSCodeToolsViewProvider(context)),

    commands.registerCommand("vscode-tools.createFile", async () => {
      try {
        const args = '{"filepath": "tmp/created-by-tool.txt", "contents": "Hello from vscode-tools test command\\n"}';
        const item = await callTool("create_file", args);
        const msg = item?.description || "File created";
        window.showInformationMessage(`CreateFile: ${msg}`);
      } catch (err) {
        console.error("CreateFile command failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        console.error("Error message:", message);
        window.showErrorMessage(`CreateFile failed: ${message}`);
      }
    }),

    commands.registerCommand("vscode-tools.readFile", async () => {
      try {
        const args = '{"filepath": "tmp/created-by-tool.txt"}';
        const item = await callTool("read_file", args);
        const contentPreview = item?.content ?? "";
        window.showInformationMessage(`ReadFile ok, length=${contentPreview.length}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        window.showErrorMessage(`ReadFile failed: ${message}`);
      }
    }),

    commands.registerCommand("vscode-tools.testTreeContext", async () => {
      try {
        const treeProvider = new TreeContextProvider();
        const contexts = await treeProvider.contexts({});

        if (contexts && contexts.length > 0) {
          const context = contexts[0];
          const message = `Tree Context: ${context.name}\nDescription: ${context.description}\nContent length: ${context.content.length}`;
          window.showInformationMessage(message);

          // 在输出面板中显示完整的树结构
          const outputChannel = window.createOutputChannel("Tree Context Test");
          outputChannel.show();
          outputChannel.appendLine("=== Project Tree Structure ===");
          outputChannel.appendLine(context.content);
        } else {
          window.showInformationMessage("No tree context generated");
        }
      } catch (err) {
        console.error("TestTreeContext command failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        window.showErrorMessage(`TestTreeContext failed: ${message}`);
      }
    }),
  );
}

export function deactivate() {}
