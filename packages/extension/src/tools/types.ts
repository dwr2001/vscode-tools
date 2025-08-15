export interface Tool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ToolImpl = (parameters: Record<string, unknown>) => Promise<ContextItem[]>;

export enum BuiltInToolNames {
  ReadFile = "read_file",
  EditExistingFile = "edit_existing_file",
  CreateNewFile = "create_new_file",
  LSTool = "ls",
}

export interface ContextItem {
  name: string;
  description: string;
  content: string;
  icon?: string;
  status?: string;
}
