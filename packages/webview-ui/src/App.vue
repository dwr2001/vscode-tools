<template>
  <header
    style="
      flex: 0 0 auto;
      padding: 8px;
    "
  >
  </header>
  <main ref="mainContainer"
    style="
      flex: 1 1 auto;
      overflow-y: auto;
      box-sizing: border-box;
    ">
    <template v-for="(message, i) in messages" :key="i">
      <UserMessage v-if="message.role === 'user'" :message="message" />
      <AssistantMessage v-else-if="message.role === 'assistant'" :message="message" @execute="call" />
    </template>
  </main>
  <footer style="flex: 0 0 auto;">
    <button class="clear-history-button" style="width: 100%;" @click="messages = []">清除历史</button>
    <Sender :status="status === 'streaming' ? 'text' : status" @submit="send" @cancel="cancel" />
  </footer>
</template>

<script setup lang="ts">
import { ToWebviewMessage } from "@vscode-tools/protocol";
import type { WebviewApi } from "vscode-webview";
import { Ref, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import Sender from "./Sender.vue";
import AssistantMessage, { AssistantMessageType } from "./components/AssistantMessage.vue";
import UserMessage, { UserMessageType } from "./components/UserMessage.vue";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { AssistantContent, streamText } from "ai";
import z from "zod/v4";
import { assert } from "./utils";

const apiKey = ref("");
const baseURL = ref("http://192.168.0.20:8098");
const thinkTag = ref(true);

const vscode: WebviewApi<unknown> | undefined = (
  import.meta.env.MODE === "development"
    ? false
    : (JSON.parse(import.meta.env.USEVSCODE || "false") as boolean)
)
  ? typeof acquireVsCodeApi !== "undefined"
    ? acquireVsCodeApi()
    : undefined
  : undefined;

const vscodeListener = async (event: MessageEvent<ToWebviewMessage>) => {
  const { command, payload } = event.data;
  console.debug("VSCode Listener Received message:", command, payload);

  switch (command) {
    case "env": {
      if (payload.key === "baseURL" && typeof payload.value === "string") {
        console.log("baseURL:", payload.value);
        baseURL.value = payload.value;
      } else if (payload.key === "thinkTag" && typeof payload.value === "boolean") {
        console.log("thinkTag:", payload.value);
        thinkTag.value = payload.value;
      } else if (payload.key === "apiKey" && typeof payload.value === "string") {
        console.log("apiKey:", payload.value);
        apiKey.value = payload.value;
      }
      break;
    }
    case "chat.delta": {
      // message(payload.type, payload.buffer);
      break;
    }
    case "chat.finish": {
      finish();
      break;
    }
    case "chat.error": {
      error(payload);
      break;
    }
    case "toolcall": {
      break;
    }
    default:
      console.warn("Unknown command:", command);
  }
};

onMounted(() => {
  if (typeof vscode !== "undefined") {
    window.addEventListener("message", vscodeListener);
    vscode.postMessage({
      command: "env",
      payload: "apiKey",
    });
  }
});

onUnmounted(() => {
  if (typeof vscode !== "undefined") {
    window.removeEventListener("message", vscodeListener);
  }
});

// messages and status - Updated to use AI SDK compatible types
const messages = ref<(UserMessageType | AssistantMessageType)[]>([]);
const status = ref<"ready" | "reasoning" | "streaming">("ready");
const index = ref(-1);

const start = () => {
  status.value = thinkTag.value ? "reasoning" : "streaming";
  index.value = messages.value.push({ role: "assistant" }) - 1;
  scrollToBottom();
};

const finish = () => {
  status.value = "ready";
  index.value = -1;
};

const error = (error: unknown) => {
  const content = `\`\`\`json
${JSON.stringify(error, null, 2)}
\`\`\``;

  const last = messages.value[index.value];
  if (last.role === "assistant") {
    last.content = content;
  }

  status.value = "ready";
  index.value = -1;
};

const call = (id: string, name: string, args: unknown) => {
  if (vscode !== undefined) {
    vscode.postMessage({
      command: "toolcall",
      payload: { id, name, args },
    });
  } else {
    // Handle tool call in webview
  }
};

const controller: Ref<AbortController | undefined> = ref(undefined);

async function cancel() {
  if (vscode !== undefined) {
    vscode.postMessage({ command: "chat.cancel" });
  } else {
    controller.value?.abort();
  }
  status.value = "ready";
}

async function send(content: string) {
  if (content.trim() === "" || status.value !== "ready") {
    console.error("unready or empty content");
    return;
  }

  messages.value.push({ role: "user", content: content.trim() });

  scrollToBottom();

  if (vscode !== undefined) {
    vscode.postMessage({ command: "chat.invoke", payload: content });
  } else {
    controller.value = new AbortController();
    const client = streamText({
      model: createDeepSeek({
        apiKey: apiKey.value,
      })("deepseek-chat"),
      messages: messages.value.map((m) =>
        m.role === "assistant"
          ? {
              role: m.role,
              content: [
                ...(m.reasoning ? [{ type: "reasoning", text: m.reasoning }] : []),
                ...(m.content ? [{ type: "text", text: m.content }] : []),
                ...(m.toolcall
                  ? Object.entries(m.toolcall).map(([id, value]) => ({
                      type: "tool-call",
                      toolCallId: id,
                      toolName: value.name,
                      input: value.args,
                    }))
                  : []),
              ] as AssistantContent,
            }
          : m,
      ),
      tools: {
        recipe: {
          description: "A tool for recipe generation",
          inputSchema: z.object({
            recipe: z.object({
              name: z.string(),
              ingredients: z.array(
                z.object({
                  name: z.string(),
                  amount: z.string(),
                }),
              ),
              steps: z.array(z.string()),
            }),
          }),
        },
      },
      abortSignal: controller.value?.signal,
      onChunk: (event) => {
        const curr = messages.value[index.value];
        assert(curr.role === "assistant", "Current message must be an assistant message");
        console.log(curr.toolcall);

        switch (event.chunk.type) {
          case "reasoning-delta": {
            curr.reasoning = (curr.reasoning || "") + event.chunk.text;
            break;
          }
          case "text-delta": {
            curr.content = (curr.content || "") + event.chunk.text;
            status.value = "streaming";
            break;
          }
          case "tool-input-start": {
            curr.toolcall = {
              ...curr.toolcall,
              [event.chunk.id]: {
                name: event.chunk.toolName,
                args: "",
              },
            };
            break;
          }
          case "tool-input-delta": {
            if (curr.toolcall?.[event.chunk.id]) {
              curr.toolcall = {
                ...curr.toolcall,
                [event.chunk.id]: {
                  ...curr.toolcall[event.chunk.id],
                  args: `${curr.toolcall[event.chunk.id].args || ""}${event.chunk.delta}`,
                },
              };
            }
            break;
          }
          case "tool-call": {
            break;
          }
        }
        scrollToBottom();
      },
      onFinish: finish,
      onError: error,
    });

    start();

    for await (const part of client.fullStream) {
      if (part.type === "start") {
        start();
      }
    }
  }
}

// scroll to bottom helper

const mainContainer = useTemplateRef("mainContainer");
const scrollToBottom = () => {
  nextTick(() => {
    mainContainer.value?.scrollTo({
      top: mainContainer.value.scrollHeight,
      behavior: "smooth",
    });
  });
};
</script>

<style scoped>
.clear-history-button {
  background-color: var(--vscode-button-background);
  border: 1px solid var(--vscode-button-border, black);
  color: var(--vscode-button-foreground);
  align-self: flex-end;
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 0.25rem;

  &:hover {
    background-color: var(--vscode-button-hoverBackground);
    border: 1px solid var(--vscode-focusBorder, darkgrey);
  }
}
</style>