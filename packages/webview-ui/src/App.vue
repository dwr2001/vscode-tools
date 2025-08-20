<template>
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
import {
  AssistantMessageType,
  CREATE_FILE,
  CREATE_FILE_DESCRIPTION,
  CREATE_FILE_SCHEMA,
  ToWebviewMessage,
  ToolCallMessageType,
  UserMessageType,
  VscodeChatAbort,
  VscodeChatDelta,
  VscodeEnvRequest,
  VscodeToolCallRequest,
} from "@vscode-tools/protocol";
import type { WebviewApi } from "vscode-webview";
import { Ref, nextTick, onMounted, onUnmounted, ref, unref, useTemplateRef } from "vue";
import Sender from "./Sender.vue";
import AssistantMessage from "./components/AssistantMessage.vue";
import UserMessage from "./components/UserMessage.vue";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { AssistantContent, ModelMessage, streamText } from "ai";
import { assert } from "./utils";

const apiKey = ref("");
const baseURL = ref("http://192.168.0.20:8098");
const thinkTag = ref(JSON.parse(process.env.USE_VSCODE || "true") as boolean);

const vscode: WebviewApi<unknown> | undefined =
  import.meta.env.MODE === "development"
    ? undefined
    : JSON.parse(process.env.USE_VSCODE || "true")
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
        baseURL.value = payload.value;
      } else if (payload.key === "thinkTag" && typeof payload.value === "boolean") {
        thinkTag.value = payload.value;
      } else if (payload.key === "apiKey" && typeof payload.value === "string") {
        apiKey.value = payload.value;
      }
      break;
    }
    case "chat.start": {
      start();
      break;
    }
    case "chat.delta": {
      chunk(payload);
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
    case "tool-call": {
      messages.value.push({ role: "tool-call", ...payload });
      break;
    }
    default:
      console.warn("Unknown command from vscode:", command);
  }
};

onMounted(() => {
  console.log("mount vscode === undefined", vscode === undefined);
  if (typeof vscode !== "undefined") {
    window.addEventListener("message", vscodeListener);
    vscode.postMessage({
      command: "env",
      payload: "apiKey",
    } as VscodeEnvRequest);
  }
});

onUnmounted(() => {
  if (typeof vscode !== "undefined") {
    window.removeEventListener("message", vscodeListener);
  }
});

// messages and status - Updated to use AI SDK compatible types
const messages = ref<(UserMessageType | AssistantMessageType | ToolCallMessageType)[]>([]);
const status = ref<"ready" | "reasoning" | "streaming">("ready");
const index = ref(-1);

const start = () => {
  index.value = messages.value.push({ role: "assistant" }) - 1;
  scrollToBottom();
};

const chunk = (chunk: VscodeChatDelta["payload"]) => {
  const curr = messages.value[index.value];
  assert(curr.role === "assistant", "Current message must be an assistant message");

  switch (chunk.type) {
    case "reasoning-delta": {
      curr.reasoning = (curr.reasoning || "") + chunk.text;
      break;
    }
    case "text-delta": {
      curr.content = (curr.content || "") + chunk.text;
      break;
    }
    case "tool-call": {
      curr.toolcall = {
        [chunk.id]: {
          ...chunk,
        },
      };
      break;
    }
  }
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
  console.log(id, "Calling tool:", name, "with args:", args);
  if (vscode !== undefined) {
    vscode.postMessage({
      command: "tool-call",
      payload: { id, name, args },
    } as VscodeToolCallRequest);
    console.log("call finish");
  } else {
    // Handle tool call in webview
  }
};

const controller: Ref<AbortController | undefined> = ref(undefined);

async function cancel() {
  if (vscode !== undefined) {
    vscode.postMessage({ command: "chat.abort" } as VscodeChatAbort);
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
    vscode.postMessage({
      command: "chat.init",
      payload: JSON.parse(JSON.stringify(unref(messages))),
    });
  } else {
    controller.value = new AbortController();
    const client = streamText({
      model: createDeepSeek({
        apiKey: apiKey.value,
      })("deepseek-chat"),
      messages: messages.value
        .map<ModelMessage | undefined>((m) => {
          switch (m.role) {
            case "assistant": {
              return {
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
              };
            }
            case "user": {
              return m;
            }
          }
        })
        .filter((m): m is ModelMessage => m !== undefined),
      tools: {
        [`${CREATE_FILE}`]: {
          description: CREATE_FILE_DESCRIPTION,
          inputSchema: CREATE_FILE_SCHEMA,
        },
      },
      abortSignal: controller.value?.signal,
      onChunk: (event) => {
        const curr = messages.value[index.value];
        assert(curr.role === "assistant", "Current message must be an assistant message");

        switch (event.chunk.type) {
          case "reasoning-delta": {
            curr.reasoning = (curr.reasoning || "") + event.chunk.text;
            break;
          }
          case "text-delta": {
            curr.content = (curr.content || "") + event.chunk.text;
            break;
          }
          case "tool-call": {
            curr.toolcall = {
              [event.chunk.toolCallId]: {
                name: event.chunk.toolName,
                args: JSON.stringify(event.chunk.input),
              },
            };
            console.log(curr.toolcall);
            break;
          }
        }
        scrollToBottom();
      },
      onFinish: finish,
      onError: error,
    });

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