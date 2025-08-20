import * as path from "node:path";
import type { READ_FILE_SCHEMA } from "@vscode-tools/protocol";
import * as vscode from "vscode";
import type z from "zod/v4";
import type { Tool } from ".";

export const readFileImpl: Tool<z.infer<typeof READ_FILE_SCHEMA>> = async ({ filepath }) => {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("No workspace folder open to resolve relative path");
  }
  const relativePath = filepath.replace(/^\.\//, "");
  const uri = vscode.Uri.joinPath(root, relativePath);

  const content = await (async () => {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const contents = new TextDecoder().decode(bytes);
      return contents;
    } catch (e) {
      return "";
    }
  })();

  return {
    name: path.basename(uri.fsPath),
    description: uri.toString(),
    content,
  };
};
