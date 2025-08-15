export interface Tool {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ToolImpl = (parameters: any) => Promise<any[]>;

export enum BuiltInToolNames {
  ReadFile = "read_file",
  EditExistingFile = "edit_existing_file",
  CreateNewFile = "create_new_file",
}
