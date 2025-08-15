import * as URI from "uri-js";
import * as vscode from "vscode";

import { VsCodeIdeUtils } from "./util/ideUtils";

class VsCodeIde{
  ideUtils: VsCodeIdeUtils;

  constructor() {
    this.ideUtils = new VsCodeIdeUtils();
  }

  async fileExists(uri: string): Promise<boolean> {
    try {
      const stat = await this.ideUtils.stat(vscode.Uri.parse(uri));
      return stat !== null;
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return false;
      }
      throw error;
    }
  }
  async writeFile(fileUri: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.parse(fileUri),
      Buffer.from(contents),
    );
  }
  async openFile(fileUri: string): Promise<void> {
    await this.ideUtils.openFile(vscode.Uri.parse(fileUri));
  }
  async saveFile(fileUri: string): Promise<void> {
    await this.ideUtils.saveFile(vscode.Uri.parse(fileUri));
  }
  private static MAX_BYTES = 100000;
  async readFile(fileUri: string): Promise<string> {
    try {
      const uri = vscode.Uri.parse(fileUri);

      // First, check whether it's a notebook document
      // Need to iterate over the cells to get full contents
      const notebook =
        vscode.workspace.notebookDocuments.find((doc) =>
          URI.equal(doc.uri.toString(), uri.toString()),
        ) ??
        (uri.path.endsWith("ipynb")
          ? await vscode.workspace.openNotebookDocument(uri)
          : undefined);
      if (notebook) {
        return notebook
          .getCells()
          .map((cell) => cell.document.getText())
          .join("\n\n");
      }

      // Check whether it's an open document
      const openTextDocument = vscode.workspace.textDocuments.find((doc) =>
        URI.equal(doc.uri.toString(), uri.toString()),
      );
      if (openTextDocument !== undefined) {
        return openTextDocument.getText();
      }

      const fileStats = await this.ideUtils.stat(uri);
      if (fileStats === null || fileStats.size > 10 * VsCodeIde.MAX_BYTES) {
        return "";
      }

      const bytes = await this.ideUtils.readFile(uri);
      if (bytes === null) {
        return "";
      }

      // Truncate the buffer to the first MAX_BYTES
      const truncatedBytes = bytes.slice(0, VsCodeIde.MAX_BYTES);
      const contents = new TextDecoder().decode(truncatedBytes);
      return contents;
    } catch (e) {
      return "";
    }
  }
  async getWorkspaceDirs(): Promise<string[]> {
    return this.ideUtils.getWorkspaceDirectories().map((uri) => uri.toString());
  }
  async getCurrentFile() {
    if (!vscode.window.activeTextEditor) {
      return undefined;
    }
    return {
      isUntitled: vscode.window.activeTextEditor.document.isUntitled,
      path: vscode.window.activeTextEditor.document.uri.toString(),
      contents: vscode.window.activeTextEditor.document.getText(),
    };
  }
}

export { VsCodeIde };
