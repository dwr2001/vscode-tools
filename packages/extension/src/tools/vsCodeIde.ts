import * as URI from "uri-js";
import * as vscode from "vscode";

const UNSUPPORTED_SCHEMES: Set<string> = new Set();
const NO_FS_PROVIDER_ERROR = "ENOPRO";
const MAX_BYTES = 100000;

export class VsCodeIde {
  private static _workspaceDirectories: vscode.Uri[] | undefined = undefined;

  private static async fsOperation<T>(
    uri: vscode.Uri,
    delegate: (uri: vscode.Uri) => T,
    ignoreMissingProviders: boolean = true,
  ): Promise<T | null> {
    const scheme = uri.scheme;
    if (ignoreMissingProviders && UNSUPPORTED_SCHEMES.has(scheme)) {
      return null;
    }
    try {
      return await delegate(uri);
    } catch (err: any) {
      if (
        ignoreMissingProviders &&
        (err.name === NO_FS_PROVIDER_ERROR || err.message?.includes(NO_FS_PROVIDER_ERROR))
      ) {
        UNSUPPORTED_SCHEMES.add(scheme);
        console.log(`Ignoring missing provider error:`, err.message);
        return null;
      }
      throw err;
    }
  }

  private static documentIsCode(uri: vscode.Uri) {
    return uri.scheme === "file" || uri.scheme === "vscode-remote";
  }

  private static async stat(uri: vscode.Uri, ignoreMissingProviders: boolean = true): Promise<vscode.FileStat | null> {
    return await VsCodeIde.fsOperation(
      uri,
      async (u) => {
        return await vscode.workspace.fs.stat(uri);
      },
      ignoreMissingProviders,
    );
  }

  private static async readFileBytes(
    uri: vscode.Uri,
    ignoreMissingProviders: boolean = true,
  ): Promise<Uint8Array | null> {
    return await VsCodeIde.fsOperation(
      uri,
      async (u) => {
        return await vscode.workspace.fs.readFile(uri);
      },
      ignoreMissingProviders,
    );
  }

  private static getViewColumnOfFile(uri: vscode.Uri): vscode.ViewColumn | undefined {
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if ((tab?.input as any)?.uri && URI.equal((tab.input as any).uri, uri.toString())) {
          return tabGroup.viewColumn;
        }
      }
    }
    return undefined;
  }

  private static getRightViewColumn(): vscode.ViewColumn {
    let column = vscode.ViewColumn.Beside;
    const columnOrdering = [
      vscode.ViewColumn.One,
      vscode.ViewColumn.Beside,
      vscode.ViewColumn.Two,
      vscode.ViewColumn.Three,
      vscode.ViewColumn.Four,
      vscode.ViewColumn.Five,
      vscode.ViewColumn.Six,
      vscode.ViewColumn.Seven,
      vscode.ViewColumn.Eight,
      vscode.ViewColumn.Nine,
    ];
    for (const tabGroup of vscode.window.tabGroups.all) {
      if (columnOrdering.indexOf(tabGroup.viewColumn) > columnOrdering.indexOf(column)) {
        column = tabGroup.viewColumn;
      }
    }
    return column;
  }

  private static async openEditorAndRevealRange(
    uri: vscode.Uri,
    range?: vscode.Range,
    viewColumn?: vscode.ViewColumn,
    preview?: boolean,
  ): Promise<vscode.TextEditor> {
    return new Promise((resolve, _) => {
      vscode.workspace.openTextDocument(uri).then(async (doc) => {
        try {
          vscode.window
            .showTextDocument(doc, {
              viewColumn: VsCodeIde.getViewColumnOfFile(uri) || viewColumn,
              preview,
            })
            .then((editor) => {
              if (range) {
                editor.revealRange(range);
              }
              resolve(editor);
            });
        } catch (error) {
          console.error("Error opening document:", error);
          resolve(vscode.window.activeTextEditor!);
        }
      });
    });
  }

  static async fileExists(uri: string): Promise<boolean> {
    try {
      const stat = await VsCodeIde.stat(vscode.Uri.parse(uri));
      return stat !== null;
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return false;
      }
      throw error;
    }
  }

  static async writeFile(fileUri: string, contents: string): Promise<void> {
    await vscode.workspace.fs.writeFile(vscode.Uri.parse(fileUri), Buffer.from(contents));
  }

  static async openFile(fileUri: string): Promise<void> {
    await VsCodeIde.openEditorAndRevealRange(vscode.Uri.parse(fileUri), undefined, vscode.ViewColumn.One, false);
  }

  static async saveFile(fileUri: string): Promise<void> {
    vscode.window.visibleTextEditors
      .filter((editor) => VsCodeIde.documentIsCode(editor.document.uri))
      .forEach((editor) => {
        if (URI.equal(editor.document.uri.toString(), fileUri)) {
          editor.document.save();
        }
      });
  }

  static async readFile(fileUri: string): Promise<string> {
    try {
      const uri = vscode.Uri.parse(fileUri);

      // First, check whether it's a notebook document
      const notebook =
        vscode.workspace.notebookDocuments.find((doc) => URI.equal(doc.uri.toString(), uri.toString())) ??
        (uri.path.endsWith("ipynb") ? await vscode.workspace.openNotebookDocument(uri) : undefined);
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

      const fileStats = await VsCodeIde.stat(uri);
      if (fileStats === null || fileStats.size > 10 * MAX_BYTES) {
        return "";
      }

      const bytes = await VsCodeIde.readFileBytes(uri);
      if (bytes === null) {
        return "";
      }

      // Truncate the buffer to the first MAX_BYTES
      const truncatedBytes = bytes.slice(0, MAX_BYTES);
      const contents = new TextDecoder().decode(truncatedBytes);
      return contents;
    } catch (e) {
      return "";
    }
  }

  static getWorkspaceDirectories(): vscode.Uri[] {
    if (VsCodeIde._workspaceDirectories === undefined) {
      VsCodeIde._workspaceDirectories = vscode.workspace.workspaceFolders?.map((folder) => folder.uri) || [];
    }
    return VsCodeIde._workspaceDirectories;
  }

  static async getWorkspaceDirs(): Promise<string[]> {
    return VsCodeIde.getWorkspaceDirectories().map((uri) => uri.toString());
  }

  static async getCurrentFile() {
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
