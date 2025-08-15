import z from "zod/v4";
import { getUriPathBasename } from "../utils/uri";
import { type ToolImpl } from "..";
import { VsCodeIde as ide } from "../vsCodeIde";
import { READ_FILE_SCHEMA } from "@vscode-tools/protocol";

export const readFileImpl: ToolImpl<z.infer<typeof READ_FILE_SCHEMA>> = async ({ filepath }) => {
  const content = await ide.readFile(filepath);

  return [
    {
      name: getUriPathBasename(filepath),
      description: filepath,
      content,
      uri: {
        type: "file",
        value: filepath,
      },
    },
  ];
};
