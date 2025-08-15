import { type ToolImpl } from "..";
import { getCleanUriPath, getUriPathBasename } from "../utils/uri";
import { VsCodeIde as ide } from "../vsCodeIde";
import z from "zod/v4";
import { CREATE_FILE_SCHEMA } from "@vscode-tools/protocol";

export const createNewFileImpl: ToolImpl<z.infer<typeof CREATE_FILE_SCHEMA>> = async ({ filepath, contents }) => {

    const exists = await ide.fileExists(filepath);
    if (exists) {
      throw new Error(`File ${filepath} already exists. Use the edit tool to edit this file`);
    }
    //writeFile
    await ide.writeFile(filepath, contents);
    await ide.openFile(filepath);
    await ide.saveFile(filepath);
    return [
      {
        name: getUriPathBasename(filepath),
        description: getCleanUriPath(filepath),
        content: "File created successfuly",
        uri: {
          type: "file",
          value: filepath,
        },
      },
    ];
};
