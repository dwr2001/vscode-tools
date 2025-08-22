export type UserMessageType = {
  role: "user";
  content: string;
};

export type AssistantMessageType = {
  role: "assistant";
  content?: string;
  reasoning?: string;
  toolcall?: Record<string, { name: string; args: string; status?: string }>;
};

export type ToolCallMessageType = {
  role: "tool-call";
  id: string;
  name: string;
  result?: unknown;
};
