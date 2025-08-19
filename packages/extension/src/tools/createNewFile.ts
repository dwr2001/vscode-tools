import * as path from "node:path";
import type { CREATE_FILE_SCHEMA } from "@vscode-tools/protocol";
import * as vscode from "vscode";
import type z from "zod/v4";
import type { Tool } from ".";

export const createNewFileImpl: Tool<z.infer<typeof CREATE_FILE_SCHEMA>> = async ({ filepath, contents }) => {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) {
    throw new Error("No workspace folder open to resolve relative path");
  }
  const relativePath = filepath.replace(/^\.\//, "");
  const targetUri = vscode.Uri.joinPath(root, relativePath);
  // Check if file exists
  const exists = await (async () => {
    try {
      const stat = await vscode.workspace.fs.stat(targetUri);
      return stat !== null;
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return false;
      }
      throw error;
    }
  })();

  if (exists) {
    throw new Error(`File ${filepath} already exists. Use the edit tool to edit this file`);
  }

  // Write file
  await vscode.workspace.fs.writeFile(targetUri, Buffer.from(contents));

  // Open file
  await (async () => {
    const doc = await vscode.workspace.openTextDocument(targetUri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
    });
  })();

  // Save file
  await (async () => {
    const editors = vscode.window.visibleTextEditors;
    const codeEditors = editors.filter(
      (editor) => editor.document.uri.scheme === "file" || editor.document.uri.scheme === "vscode-remote",
    );
    for (const editor of codeEditors) {
      if (editor.document.uri.toString() === targetUri.toString()) {
        await editor.document.save();
      }
    }
  })();

  return [
    {
      name: path.basename(targetUri.fsPath),
      description: targetUri.toString(),
      content: "File created successfuly",
      uri: {
        type: "file",
        value: targetUri.toString(),
      },
    },
  ];
};
