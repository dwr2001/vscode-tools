export { callBuiltInTool } from "./callTool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ToolImpl<Arg> = (parameters: Arg) => Promise<ContextItem[]>;

export interface ContextItem {
  name: string;
  description: string;
  content: string;
  icon?: string;
  status?: string;
}