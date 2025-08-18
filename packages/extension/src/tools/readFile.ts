import * as path from "node:path";
import type { READ_FILE_SCHEMA } from "@vscode-tools/protocol";
import * as vscode from "vscode";
import type z from "zod/v4";
import type { Tool } from ".";

export const readFileImpl: Tool<z.infer<typeof READ_FILE_SCHEMA>> = async ({ filepath }) => {
  const content = await (async () => {
    try {
      const uri = vscode.Uri.parse(filepath);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const contents = new TextDecoder().decode(bytes);
      return contents;
    } catch (e) {
      return "";
    }
  })();

  return [
    {
      name: path.basename(filepath),
      description: filepath,
      content,
      uri: {
        type: "file",
        value: filepath,
      },
    },
  ];
};
