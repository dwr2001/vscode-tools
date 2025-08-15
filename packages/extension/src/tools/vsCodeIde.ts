import * as URI from "uri-js";
import * as vscode from "vscode";

export class VsCodeIde {
  private static _workspaceDirectories: vscode.Uri[] | undefined = undefined;

  private static documentIsCode(uri: vscode.Uri) {
    return uri.scheme === "file" || uri.scheme === "vscode-remote";
  }

  private static async stat(uri: vscode.Uri): Promise<vscode.FileStat | null> {
    try {
      return await vscode.workspace.fs.stat(uri);
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return null;
      }
      throw error;
    }
  }

  private static getViewColumnOfFile(uri: vscode.Uri): vscode.ViewColumn | undefined {
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        // VS Code's TabInput types are union types; use narrowing instead of any
        const input: unknown = tab?.input as unknown;
        const inputWithUri = input as { uri?: unknown };
        if (inputWithUri?.uri && URI.equal(inputWithUri.uri as unknown as string, uri.toString())) {
          return tabGroup.viewColumn;
        }
      }
    }
    return undefined;
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
          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor) {
            resolve(activeEditor);
            return;
          }
          resolve({} as vscode.TextEditor);
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
    const editors = vscode.window.visibleTextEditors;
    const codeEditors = editors.filter((editor) => VsCodeIde.documentIsCode(editor.document.uri));
    for (const editor of codeEditors) {
      if (URI.equal(editor.document.uri.toString(), fileUri)) {
        editor.document.save();
      }
    }
  }

  static async readFile(fileUri: string): Promise<string> {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const contents = new TextDecoder().decode(bytes);
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
