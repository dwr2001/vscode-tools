import { ContextItem } from "../context";
import { BuiltInToolNames } from "./types";

import { createNewFileImpl } from "./implementations/createNewFile";
import { readFileImpl } from "./implementations/readFile";
export async function callBuiltInTool(functionName: string, args: any): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.ReadFile:
      return await readFileImpl(args);
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args);
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}
