import { z } from "zod/v4";

export const CREATE_FILE_SCHEMA = z.object({
  filepath: z.string().describe("The path where the new file should be created, relative to the root of the workspace"),
  contents: z.string().describe("The contents to write to the new file"),
});

export const CREATE_FILE_DESCRIPTION =
  "Create a new file. Only use this when a file doesn't exist and should be created";
