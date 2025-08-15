import { BuiltInToolNames, type Tool } from "../types";

export const createNewFileTool: Tool = {
  name: BuiltInToolNames.CreateNewFile,
  description: "Create a new file. Only use this when a file doesn't exist and should be created",
  parameters: {
    type: "object",
    required: ["filepath", "contents"],
    properties: {
      filepath: {
        type: "string",
        description: "The path where the new file should be created, relative to the root of the workspace",
      },
      contents: {
        type: "string",
        description: "The contents to write to the new file",
      },
    },
  },
};
