import * as toolDefinitions from "./definitions";
import { ToolImpl, Tool, ToolCall, BuiltInToolNames } from "./types";
import { callBuiltInTool } from "./callTool";

const getToolDefinitions = () => [
  toolDefinitions.createNewFileTool,
  toolDefinitions.editFileTool,
  toolDefinitions.readFileTool,
];

export { ToolImpl, Tool, ToolCall, BuiltInToolNames, callBuiltInTool, getToolDefinitions };
export { createNewFileTool, editFileTool, readFileTool } from "./definitions";
