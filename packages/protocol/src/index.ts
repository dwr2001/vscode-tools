import type { AssistantMessageType, ToolCallMessageType, UserMessageType } from "./message";

export {
  CREATE_FILE_SCHEMA,
  CREATE_FILE_DESCRIPTION,
  CREATE_FILE,
  type CREATE_FILE_PARAMETERS,
} from "./tools/create-file";
export { READ_FILE_SCHEMA, READ_FILE_DESCRIPTION, READ_FILE, type READ_FILE_PARAMETERS } from "./tools/read-file";
export * from "./message";

export type Protocol<C extends string, P> = {
  command: C;
  payload: P;
};

export type ToVscode<C extends string, P = void> = Protocol<C, P>;
export type ToWebview<C extends string, P = void> = Protocol<C, P>;

// message from webview to vscode

export type VscodeChatAbort = ToVscode<"chat.abort">;
export type VscodeChatInit = ToVscode<"chat.init", Array<UserMessageType | AssistantMessageType | ToolCallMessageType>>;

export type VscodeEnvRequest = ToWebview<"env", string>;

/**
 * @deprecated
 */
export type VscodeToolCallRequest = ToVscode<
  "tool-call",
  {
    id: string;
    name: string;
    args: string;
  }
>;

export type ToVscodeMessage = VscodeChatAbort | VscodeChatInit | VscodeEnvRequest | VscodeToolCallRequest;

// message from vscode to webview

export type VscodeChatStart = ToWebview<"chat.start">;
export type VscodeChatDelta = ToWebview<
  "chat.delta",
  | {
      type: "reasoning-delta" | "text-delta";
      text: string;
    }
  | {
      type: "tool-call-delta";
      id: string;
      name?: string;
      args?: string;
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

export type VscodeEnvResponse = ToWebview<"env", { key: string; value?: unknown }>;

export type VscodeToolCallResponse = ToWebview<
  "tool-call",
  {
    id: string;
    name: string;
    result: string;
  }
>;

export type VscodeFakeMessage = ToWebview<"fake-message", string>;

export type ToWebviewMessage =
  | VscodeChatDelta
  | VscodeChatError
  | VscodeChatFinish
  | VscodeChatStart
  | VscodeEnvResponse
  | VscodeToolCallResponse
  | VscodeFakeMessage;

// Bidirectional communication message

export type VscodeToolCall = Protocol<
  "tool-call",
  {
    id: string;
    name: string;
    args: string;
  }
>;
export type VscodeToolCallResult = Protocol<
  "tool-call-result",
  {
    id: string;
    name: string;
    result: string;
  }
>;
