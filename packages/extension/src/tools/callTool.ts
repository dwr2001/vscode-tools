import {ContextItem} from "../context"
import { BuiltInToolNames } from "./types";
import { VsCodeIde } from "../extension/VsCodeIde";

import { createNewFileImpl } from "./implementations/createNewFile";
import { readFileImpl } from "./implementations/readFile";
export async function callBuiltInTool(
  functionName: string,
  args: any,
  ide: VsCodeIde
): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.ReadFile:
      return await readFileImpl(args,ide);
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args,ide);
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}