import { inferResolvedUriFromRelativePath } from "../utils/ideUtils";
import { type ToolImpl } from "..";
import { getCleanUriPath, getUriPathBasename } from "../utils/uri";
import { VsCodeIde as ide } from "../vsCodeIde";
import z from "zod/v4";
import { CREATE_FILE_SCHEMA } from "@vscode-tools/protocol";

export const createNewFileImpl: ToolImpl<z.infer<typeof CREATE_FILE_SCHEMA>> = async ({ filepath, contents }) => {
  const resolvedFileUri = await inferResolvedUriFromRelativePath(filepath);
  if (resolvedFileUri) {
    const exists = await ide.fileExists(resolvedFileUri);
    if (exists) {
      throw new Error(`File ${filepath} already exists. Use the edit tool to edit this file`);
    }
    await ide.writeFile(resolvedFileUri, contents);
    await ide.openFile(resolvedFileUri);
    await ide.saveFile(resolvedFileUri);
    return [
      {
        name: getUriPathBasename(resolvedFileUri),
        description: getCleanUriPath(resolvedFileUri),
        content: "File created successfuly",
        uri: {
          type: "file",
          value: resolvedFileUri,
        },
      },
    ];
  }
  throw new Error("Failed to resolve path");
};
