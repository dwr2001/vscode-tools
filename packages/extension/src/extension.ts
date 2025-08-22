import * as fs from "node:fs";
import * as path from "node:path";
import { type ExtensionContext, type TextDocument, type Uri, commands, window, workspace } from "vscode";
import { TreeContextProvider } from "./context/tree-context-provider";
import { callTool } from "./tools/callTool";
import { VSCodeToolsViewProvider } from "./webview-view-provider";

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "vscode-tools" is now active!');

  // 创建VSCodeToolsViewProvider实例
  const webviewViewProvider = new VSCodeToolsViewProvider(context);

  context.subscriptions.push(
    commands.registerCommand("vscode-tools.helloWorld", () => {
      window.showInformationMessage("Hello World from vscode-tools!");
    }),

    window.registerWebviewViewProvider("vscode-tools.view", webviewViewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),

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

    commands.registerCommand("vscode-tools.generateUnitTest", async (uri?: Uri) => {
      try {
        // 获取当前选中的文件或活动编辑器
        let document: TextDocument | undefined;
        let filePath: string;
        let fileName: string;
        let fileExtension: string;

        if (uri) {
          // 从右键菜单调用，使用uri参数
          filePath = uri.fsPath;
          fileName = path.basename(filePath);
          fileExtension = fileName.split(".").pop() || "";

          // 尝试打开文档
          try {
            document = await workspace.openTextDocument(uri);
          } catch (e) {
            console.error("Failed to open document:", e);
          }
        } else {
          // 从命令面板调用，使用活动编辑器
          const activeEditor = window.activeTextEditor;
          if (!activeEditor) {
            window.showWarningMessage("请先选择一个文件来生成单元测试");
            return;
          }
          document = activeEditor.document;
          filePath = document.fileName;
          fileName = document.fileName.split(/[/\\]/).pop() || "";
          fileExtension = fileName.split(".").pop() || "";
        }

        // 读取文件内容
        let fileContent = "";
        if (document) {
          fileContent = document.getText();
        } else {
          // 如果无法打开文档，尝试直接读取文件
          try {
            fileContent = fs.readFileSync(filePath, "utf8");
          } catch (e) {
            window.showErrorMessage("无法读取文件内容");
            return;
          }
        }

        // 构建提示词
        const prompt = `请为以下代码生成适量的单元测试。要求：
1. 测试覆盖基本的功能
2. 使用适当的测试框架
3. 包含详细的测试描述
4. 测试代码要清晰易懂

代码内容：
\`\`\`${fileExtension}
${fileContent}
\`\`\`

请生成完整的测试文件内容：`;

        // 自动打开并聚焦侧栏到本插件视图
        await commands.executeCommand("workbench.view.extension.onigiri-container");
        await commands.executeCommand("vscode-tools.view.focus");

        // 向前端发送消息
        await webviewViewProvider.sendFakeMessage(`请为 ${fileName} 生成单元测试`);

        // 发送消息到webview来生成测试内容
        await webviewViewProvider.generateUnitTest(prompt);
      } catch (err) {
        console.error("GenerateUnitTest command failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        window.showErrorMessage(`GenerateUnitTest failed: ${message}`);
      }
    }),
  );
}

export function deactivate() {}
