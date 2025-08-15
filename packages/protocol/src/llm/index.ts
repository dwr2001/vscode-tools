import { streamText } from 'ai';

export default class SSEClient {
  private controller?: AbortController;
  public status: "ready" | "thinking" | "answering" = "ready";
  private count = 0;

  constructor(
    private readonly baseURL: string,
    private readonly thinkTag: boolean,
    private readonly open: (response: Response) => void,
    private readonly onmessage: (type: "thinking" | "answering", buffer: string) => void,
    private readonly onclose: () => void,
    private readonly onerror: (error: unknown) => void,
  ) {
    const c = streamText({
      model: 'openai/gpt-4.1',
      prompt: 'Invent a new holiday and describe its traditions.',
    })
  }

  public async invoke(content: string) {
    if (content.trim() === "" || this.status !== "ready") {
      console.error("unready or empty content");
      return;
    }

    try {
      this.controller = new AbortController();
      const c = streamText({
        model: 'openai/gpt-4.1',
        prompt: 'Invent a new holiday and describe its traditions.',
        abortSignal: this.controller.signal,
        onAbort: async () => {},
        onChunk: async (chunk) => {
          console.log("SSEClient: stream chunk received:", chunk);
        },
        onError: async (error) => {
          console.error("SSEClient: stream error:", error);
        },
        onFinish: async () => {
          console.log("SSEClient: stream finished.");
        },
      });
    } catch (error) {
      console.log(error);
    }
  }
}
