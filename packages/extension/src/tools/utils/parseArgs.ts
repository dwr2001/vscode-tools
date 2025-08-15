import type { ToolCall } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function safeParseToolCallArgs(toolCall: ToolCall): Record<string, unknown> {
  try {
    return JSON.parse(toolCall.arguments?.trim() || "{}");
  } catch (e) {
    return {};
  }
}

export function getStringArg(args: unknown, argName: string, allowEmpty = false): string {
  if (!isRecord(args) || !(argName in args) || typeof args[argName] !== "string") {
    throw new Error(`\`${argName}\` argument is required${allowEmpty ? "" : " and must not be empty"}. (type string)`);
  }
  const value = args[argName] as string;
  if (!allowEmpty && !value.trim()) {
    throw new Error(`Argument ${argName} must not be empty`);
  }
  return value;
}

export function getOptionalStringArg(args: unknown, argName: string, allowEmpty = false) {
  if (!isRecord(args) || typeof args?.[argName] === "undefined") {
    return undefined;
  }
  return getStringArg(args, argName, allowEmpty);
}

export function getBooleanArg(args: unknown, argName: string, required = false): boolean | undefined {
  if (!isRecord(args) || !(argName in args)) {
    if (required) {
      throw new Error(`Argument \`${argName}\` is required (type boolean)`);
    }
    return undefined;
  }
  const value = args[argName];
  if (typeof value === "string") {
    if (value.toLowerCase() === "false") {
      return false;
    }
    if (value.toLowerCase() === "true") {
      return true;
    }
  }
  if (typeof value !== "boolean") {
    throw new Error(`Argument \`${argName}\` must be a boolean true or false`);
  }
  return value;
}
