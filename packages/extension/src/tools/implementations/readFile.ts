import z from "zod/v4";
import { resolveRelativePathInDir } from "../utils/ideUtils";
import { getUriPathBasename } from "../utils/uri";
import { type ToolImpl } from "..";
import { VsCodeIde as ide } from "../vsCodeIde";
import { READ_FILE_SCHEMA } from "@vscode-tools/protocol";

export const readFileImpl: ToolImpl<z.infer<typeof READ_FILE_SCHEMA>> = async ({ filepath }) => {
  const firstUriMatch = await resolveRelativePathInDir(filepath);
  if (!firstUriMatch) {
    throw new Error(`File "${filepath}" does not exist. You might want to check the path and try again.`);
  }
  const content = await ide.readFile(firstUriMatch);

  return [
    {
      name: getUriPathBasename(firstUriMatch),
      description: filepath,
      content,
      uri: {
        type: "file",
        value: firstUriMatch,
      },
    },
  ];
};
