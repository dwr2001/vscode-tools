import type { AssistantMessageType, ToolCallMessageType, UserMessageType } from "./message";

export {
  CREATE_FILE_SCHEMA,
  CREATE_FILE_DESCRIPTION,
  CREATE_FILE,
  type CREATE_FILE_PARAMETERS,
} from "./tools/create-file";
export { READ_FILE_SCHEMA, READ_FILE_DESCRIPTION, READ_FILE, type READ_FILE_PARAMETERS } from "./tools/read-file";
export * from "./message";

export type Protocol<T extends "vscode" | "webview", C extends string, P> = {
  to: T;
  command: C;
  payload: P;
};

export type ToVscode<C extends string, P = void> = Protocol<"vscode", C, P>;
export type ToWebview<C extends string, P = void> = Protocol<"webview", C, P>;

// message from webview to vscode

export type VscodeChatAbort = ToVscode<"chat.abort">;
export type VscodeChatStart = ToVscode<
  "chat.start",
  Array<UserMessageType | AssistantMessageType | ToolCallMessageType>
>;

export type VscodeEnvRequest = ToWebview<"env", string>;

export type VscodeToolCallRequest = ToVscode<
  "tool-call",
  {
    id: string;
    name: string;
    args: string;
  }
>;

export type ToVscodeMessage = VscodeChatAbort | VscodeChatStart | VscodeEnvRequest | VscodeToolCallRequest;

// message from vscode to webview

export type VscodeChatDelta = ToWebview<
  "chat.delta",
  | {
      type: "reasoning-delta" | "text-delta";
      text: string;
    }
  | {
      type: "tool-call";
      id: string;
      name: string;
      args: string;
    }
>;
export type VscodeChatError = ToWebview<"chat.error", string>;
export type VscodeChatFinish = ToWebview<"chat.finish">;

export type VscodeChatStartResponse = ToWebview<
  "chat.start",
  { status: "ready" | "reasoning" | "streaming"; index: number }
>;
export type VscodeChatAbortResponse = ToWebview<
  "chat.abort",
  { status: "ready" | "reasoning" | "streaming"; index: number }
>;

export type VscodeEnvResponse = ToWebview<"env", { key: string; value?: unknown }>;

export type VscodeToolCallResponse = ToWebview<
  "tool-call",
  {
    id: string;
    name: string;
    result: string;
  }
>;

export type ToWebviewMessage =
  | VscodeChatDelta
  | VscodeChatError
  | VscodeChatFinish
  | VscodeChatStartResponse
  | VscodeChatAbortResponse
  | VscodeEnvResponse
  | VscodeToolCallResponse;
