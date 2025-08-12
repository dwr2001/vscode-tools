export type ContextProviderDescription = {
  title: string;
  displayTitle: string;
  description: string;
  renderInlineAs?: string;
  dependsOnIndexing?: boolean;
}

export interface ContextItem {
  name: string;
  description: string;
  content: string;
  icon?: string;
  status?: string;
}

export interface ContextProvider<Q> {

  get description(): ContextProviderDescription;

  contexts(query: Q): Promise<ContextItem[]>;
}