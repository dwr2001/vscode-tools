import type { ContextItem } from "../context";

import { CREATE_FILE_SCHEMA, READ_FILE_SCHEMA } from "@vscode-tools/protocol";
import { createNewFileImpl } from "./createNewFile";
import { readFileImpl } from "./readFile";

export async function callTool(functionName: string, args: unknown): Promise<ContextItem[]> {
  const normalizedArgs = JSON.parse(args as string) as Record<string, unknown>;

  switch (functionName) {
    case "read_file": {
      const parsed = READ_FILE_SCHEMA.parse(normalizedArgs);
      return await readFileImpl(parsed);
    }
    case "create_file":
    case "create_new_file": {
      const parsed = CREATE_FILE_SCHEMA.parse(normalizedArgs);
      return await createNewFileImpl(parsed);
    }
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}
