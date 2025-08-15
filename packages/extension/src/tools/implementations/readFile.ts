import { resolveRelativePathInDir } from "../utils/ideUtils";
import { getUriPathBasename } from "../utils/uri";

import { ToolImpl } from "../types";
import { getStringArg } from "../parseArgs";

export const readFileImpl: ToolImpl = async (args, ide) => {
  const filepath = getStringArg(args, "filepath");

  const firstUriMatch = await resolveRelativePathInDir(filepath, ide);
  if (!firstUriMatch) {
    throw new Error(
      `File "${filepath}" does not exist. You might want to check the path and try again.`,
    );
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
