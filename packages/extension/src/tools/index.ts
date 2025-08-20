import type { ContextItem } from "../context";

export { callTool } from "./callTool";

export type Tool<Arg> = (parameters: Arg) => Promise<ContextItem>;
