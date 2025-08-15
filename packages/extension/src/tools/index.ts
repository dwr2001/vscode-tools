import { callBuiltInTool } from "./callTool";
import * as toolDefinitions from "./definitions";
import { BuiltInToolNames, Tool, ToolCall, ToolImpl } from "./types";

const getToolDefinitions = () => [
  toolDefinitions.createNewFileTool,
  toolDefinitions.editFileTool,
  toolDefinitions.readFileTool,
];

export { ToolImpl, Tool, ToolCall, BuiltInToolNames, callBuiltInTool, getToolDefinitions };
export { createNewFileTool, editFileTool, readFileTool } from "./definitions";
