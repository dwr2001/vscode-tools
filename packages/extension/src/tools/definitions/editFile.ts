import { Tool, BuiltInToolNames } from "../types";
import { EDIT_CODE_INSTRUCTIONS } from "../prompt/defaultSystemMessages";

export interface EditToolArgs {
  filepath: string;
  changes: string;
}

const CHANGES_DESCRIPTION =
  "Any modifications to the file, showing only needed changes. Do NOT wrap this in a codeblock or write anything besides the code changes. In larger files, use brief language-appropriate placeholders for large unmodified sections, e.g. '// ... existing code ...'";

export const editFileTool: Tool = {
  name: BuiltInToolNames.EditExistingFile,
  description: `Use this tool to edit an existing file. If you don't know the contents of the file, read it first.\n${EDIT_CODE_INSTRUCTIONS}\n`,
  parameters: {
    type: "object",
    required: ["filepath", "changes"],
    properties: {
      filepath: {
        type: "string",
        description: "The path of the file to edit, relative to the root of the workspace.",
      },
      changes: {
        type: "string",
        description: CHANGES_DESCRIPTION,
      },
    },
  },
};
