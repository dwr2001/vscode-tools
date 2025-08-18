import * as path from "node:path";
import type { CREATE_FILE_SCHEMA } from "@vscode-tools/protocol";
import * as vscode from "vscode";
import type z from "zod/v4";
import type { Tool } from ".";

export const createNewFileImpl: Tool<z.infer<typeof CREATE_FILE_SCHEMA>> = async ({ filepath, contents }) => {
  // Check if file exists
  const exists = await (async () => {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.parse(filepath));
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
  await vscode.workspace.fs.writeFile(vscode.Uri.parse(filepath), Buffer.from(contents));

  // Open file
  await (async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(filepath));
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
      if (editor.document.uri.toString() === filepath) {
        await editor.document.save();
      }
    }
  })();

  return [
    {
      name: path.basename(filepath),
      description: filepath,
      content: "File created successfuly",
      uri: {
        type: "file",
        value: filepath,
      },
    },
  ];
};
