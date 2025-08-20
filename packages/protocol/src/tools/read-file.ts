import { z } from "zod/v4";

export const READ_FILE_SCHEMA = z.object({
  filepath: z
    .string()
    .describe("The path of the file to read, relative to the root of the workspace (NOT uri or absolute path)"),
});

export const READ_FILE_DESCRIPTION = "Use this tool if you need to view the contents of an existing file.";

export type READ_FILE_PARAMETERS = z.infer<typeof READ_FILE_SCHEMA>;

export const READ_FILE = "read_file";
