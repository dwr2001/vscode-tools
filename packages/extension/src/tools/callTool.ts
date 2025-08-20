import type { ContextItem } from "../context";

import { CREATE_FILE, CREATE_FILE_SCHEMA, READ_FILE, READ_FILE_SCHEMA } from "@vscode-tools/protocol";
import { createFileImpl } from "./createFile";
import { readFileImpl } from "./readFile";

export async function callTool(functionName: string, args: string): Promise<ContextItem> {
  const normalizedArgs = JSON.parse(args);

  switch (functionName) {
    case READ_FILE: {
      const parsed = READ_FILE_SCHEMA.parse(normalizedArgs);
      return await readFileImpl(parsed);
    }
    case CREATE_FILE: {
      const parsed = CREATE_FILE_SCHEMA.parse(normalizedArgs);
      return await createFileImpl(parsed);
    }
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}
