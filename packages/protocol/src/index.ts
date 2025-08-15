export type Protocol<T extends "vscode" | "webview", C extends string, P> = {
  to: T;
  command: C;
  payload: P;
};

export type ToVscode<C extends string, P = void> = Protocol<"vscode", C, P>;
export type ToWebview<C extends string, P = void> = Protocol<"webview", C, P>;

// message from webview to vscode

export type VscodeChatAbort = ToVscode<"chat.abort">;
export type VscodeChatStart = ToVscode<"chat.start">;

export type VscodeEnvRequest = ToWebview<"env", string>;

export type VscodeToolcallRequest = ToVscode<
  "toolcall",
  {
    id: string;
    name: string;
    args: unknown;
  }
>;

export type ToVscodeMessage = 
  | VscodeChatAbort
  | VscodeChatStart
  | VscodeEnvRequest
  | VscodeToolcallRequest;

// message from vscode to webview

export type VscodeChatDelta = ToWebview<
  "chat.delta",
  | {
      type: "reasoning-delta" | "text-delta";
      text: string;
    }
  | {
      type: "tool-input-start";
      id: string;
      name: string;
    }
  | {
      type: "tool-input-delta";
      id: string;
      delta: string;
    }
>;
export type VscodeChatError = ToWebview<"chat.error", string>;
export type VscodeChatFinish = ToWebview<"chat.finish">;

export type VscodeEnvResponse = ToWebview<"env", { key: string; value?: unknown }>;

export type VscodeToolcallResponse = ToWebview<
  "toolcall",
  {
    id: string;
    result?: unknown;
  }
>;

export type ToWebviewMessage =
  | VscodeChatDelta
  | VscodeChatError
  | VscodeChatFinish
  | VscodeEnvResponse
  | VscodeToolcallResponse;
