import type { ContextItem } from "../context";

import { CREATE_FILE_SCHEMA, READ_FILE_SCHEMA } from "@vscode-tools/protocol";
import { createNewFileImpl } from "./createNewFile";
import { readFileImpl } from "./readFile";

export async function callTool(functionName: string, args: Record<string, unknown>): Promise<ContextItem[]> {
  switch (functionName) {
    case "read_file": {
      const parsed = READ_FILE_SCHEMA.parse(args);
      return await readFileImpl(parsed);
    }
    case "create_new_file": {
      const parsed = CREATE_FILE_SCHEMA.parse(args);
      return await createNewFileImpl(parsed);
    }
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}
