import { ContextItem } from "../context";

export type Tool = <Arg>(arg: Arg) => Promise<ContextItem[]>;