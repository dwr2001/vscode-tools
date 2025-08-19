import dirTree from "directory-tree";
// @ts-expect-error
import treeify from "treeify";
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

      // Build directory structure with directory-tree, then render via treeify
      const tree = dirTree(rootPath, {
        normalizePath: true,
        exclude: [/node_modules/, /(^|\/)\./],
      });
      const toPlainObj = (node: unknown): Record<string, unknown> | null => {
        if (!node || typeof node !== "object") return null;
        const children = (node as { children?: unknown }).children;
        if (!Array.isArray(children)) return null;
        const entries: [string, unknown][] = [];
        for (const child of children as unknown[]) {
          const childName = (child as { name?: unknown }).name;
          if (typeof childName !== "string") continue;
          entries.push([childName, toPlainObj(child)]);
        }
        return Object.fromEntries(entries);
      };
      const plainObj = toPlainObj(tree) ?? {};
      const treeOutput = treeify.asTree(plainObj, true);

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
}
