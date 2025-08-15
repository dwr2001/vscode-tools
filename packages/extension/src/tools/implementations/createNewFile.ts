import { inferResolvedUriFromRelativePath } from "../utils/ideUtils";

import { ContextItem, type ToolImpl } from "../types";
import { getStringArg } from "../utils/parseArgs";
import { getCleanUriPath, getUriPathBasename } from "../utils/uri";
import { VsCodeIde as ide } from "../vsCodeIde";

export const createNewFileImpl: ToolImpl = async (args) => {
  const filepath = getStringArg(args, "filepath");
  const contents = getStringArg(args, "contents", true);

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
