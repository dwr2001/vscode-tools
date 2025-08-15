import * as vscode from "vscode";
import type { ContextItem, ContextProvider } from "./index";

export type TreeContextQuery = {};

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
    return new Promise((resolve, reject) => {
      const { spawn } = require("node:child_process");

      // Determine the tree command based on the platform
      const isWindows = process.platform === "win32";
      const command = isWindows ? "tree" : "tree";
      const args = isWindows ? ["/F", "/A"] : ["-a", "-I", "node_modules|.git"];

      const child = spawn(command, args, {
        cwd: rootPath,
        shell: true,
      });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on("close", (code: number) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          // If tree command fails, try to provide a fallback
          if (isWindows) {
            // On Windows, if tree command fails, try dir command
            this.executeDirCommand(rootPath).then(resolve).catch(reject);
          } else {
            reject(new Error(`Tree command failed with code ${code}: ${errorOutput}`));
          }
        }
      });

      child.on("error", (error: Error) => {
        // If tree command is not available, try alternative approaches
        if (isWindows) {
          this.executeDirCommand(rootPath).then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });
    });
  }

  private async executeDirCommand(rootPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require("node:child_process");

      const child = spawn("dir", ["/B", "/S"], {
        cwd: rootPath,
        shell: true,
      });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on("close", (code: number) => {
        if (code === 0) {
          // Convert dir output to a tree-like format
          const lines = output.split("\n").filter((line) => line.trim());
          const treeOutput = lines
            .map((line) => {
              const relativePath = line.replace(rootPath, "").replace(/\\/g, "/");
              const depth = (relativePath.match(/\//g) || []).length;
              const indent = "  ".repeat(depth);
              const fileName = relativePath.split("/").pop() || "";
              return `${indent}${fileName}`;
            })
            .join("\n");
          resolve(treeOutput);
        } else {
          reject(new Error(`Dir command failed with code ${code}: ${errorOutput}`));
        }
      });

      child.on("error", (error: Error) => {
        reject(error);
      });
    });
  }
}
