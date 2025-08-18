import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ContextItem, ContextProvider } from "./index";

export type TreeContextQuery = Record<string, never>;

export class TreeContextProvider implements ContextProvider<TreeContextQuery> {
  get description() {
    return {
      title: "Project Tree",
      displayTitle: "Project Tree",
      description: "Shows the project directory structure using the tree command",
      renderInlineAs: "tree",
      dependsOnIndexing: false,
    };
  }

  async contexts(query: TreeContextQuery): Promise<ContextItem[]> {
    try {
      // Get the workspace root directory
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return [
          {
            name: "Project Tree",
            description: "No workspace found",
            content: "```\nNo workspace found\n```",
          },
        ];
      }

      const rootPath = workspaceFolders[0].uri.fsPath;

      // Execute the tree command
      const treeOutput = await this.executeTreeCommand(rootPath);

      // Wrap the output in a markdown code block
      const content = `\`\`\`\n${treeOutput}\n\`\`\``;

      return [
        {
          name: "Project Tree",
          description: `Directory structure of ${workspaceFolders[0].name}`,
          content,
        },
      ];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [
        {
          name: "Project Tree",
          description: "Error executing tree command",
          content: `\`\`\`\nError: ${errorMessage}\n\`\`\``,
        },
      ];
    }
  }

  private async executeTreeCommand(rootPath: string): Promise<string> {
    // 使用 Node.js fs 模块生成树结构，避免编码问题

    function generateTree(dir: string, prefix = "", isLast = true): string[] {
      const items = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((item: fs.Dirent) => !item.name.startsWith(".") && item.name !== "node_modules")
        .sort((a: fs.Dirent, b: fs.Dirent) => {
          // 文件夹在前，文件在后
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      const lines: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isLastItem = i === items.length - 1;
        const connector = isLastItem ? "└── " : "├── ";
        const nextPrefix = isLastItem ? "    " : "│   ";

        lines.push(prefix + connector + item.name);

        if (item.isDirectory()) {
          const subDir = path.join(dir, item.name);
          const subLines = generateTree(subDir, prefix + nextPrefix, isLastItem);
          lines.push(...subLines);
        }
      }

      return lines;
    }

    try {
      const treeLines = generateTree(rootPath);
      return treeLines.join("\n");
    } catch (error) {
      throw new Error(`Failed to generate tree: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
