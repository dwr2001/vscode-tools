export type ToWebview<C, P> = {
  command: C;
  payload: P;
}

export type VscodeEnv = ToWebview<"webview.env", { key: string; value: unknown | undefined }>;

// Chat stream events
export type VscodeChatStart = ToWebview<"webview.chat.start", { id: string }>;

export type VscodeChatDelta = ToWebview<"webview.chat.delta", { 
  id: string; 
  type: "text" | "tool_call";
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
}>;

export type VscodeChatFinish = ToWebview<"webview.chat.finish", { 
  id: string;
  finishReason: "stop" | "length" | "content_filter" | "tool_calls";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}>;

export type VscodeChatError = ToWebview<"webview.chat.error", { 
  id: string;
  error: string;
  details?: unknown;
}>;

// Tool call events
export type VscodeToolCallRequest = ToWebview<"webview.tool.request", {
  id: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}>;

export type VscodeToolCallResponse = ToWebview<"webview.tool.response", {
  id: string;
  toolCallId: string;
  result: unknown;
  error?: string;
}>;

// Legacy types (keeping for compatibility)
export type VscodeChatOpen = ToWebview<"webview.chat.open", Response>;
export type VscodeChatMessage = ToWebview<"webview.chat.message", { type: "thinking" | "answering"; buffer: string }>;
export type VscodeChatClose = ToWebview<"webview.chat.close", undefined>;

// Union type for all webview messages
export type WebviewMessage = 
  | VscodeEnv
  | VscodeChatStart
  | VscodeChatDelta
  | VscodeChatFinish
  | VscodeChatError
  | VscodeToolCallRequest
  | VscodeToolCallResponse
  | VscodeChatOpen
  | VscodeChatMessage
  | VscodeChatClose;

// Message types from webview to extension
export type FromWebview<C, P> = {
  command: C;
  payload: P;
}

export type WebviewChatRequest = FromWebview<"chat.send", {
  message: string;
  conversationId?: string;
}>;

export type WebviewToolResponse = FromWebview<"tool.response", {
  toolCallId: string;
  result: unknown;
  error?: string;
}>;

export type WebviewMessage_FromWebview = 
  | WebviewChatRequest
  | WebviewToolResponse;