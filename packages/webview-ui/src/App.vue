<template>
  <main ref="mainContainer"
    style="
      flex: 1 1 auto;
      overflow-y: auto;
      box-sizing: border-box;
    ">
    <template v-for="(message, i) in messages" :key="i">
      <UserMessage v-if="message.role === 'user'" :message="message" />
      <AssistantMessage v-else-if="message.role === 'assistant'" :message="message" @execute="tool$call" @cancel="cancelToolCall" />
    </template>
  </main>
  <footer style="flex: 0 0 auto;">
    <button class="clear-history-button" style="width: 100%;" @click="messages = []">清除历史</button>
    <Sender :status="status.state" @submit="send" @cancel="abort" />
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
  VscodeChatError,
  VscodeChatFinish,
  VscodeChatInit,
  VscodeChatStart,
  VscodeEnvRequest,
  VscodeToolCall,
  VscodeToolCallResult,
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
      start(payload);
      break;
    }
    case "chat.delta": {
      chunk(payload);
      break;
    }
    case "chat.finish": {
      finish(payload);
      break;
    }
    case "chat.error": {
      error(payload);
      break;
    }
    case "tool-call-result": {
      await tool$call$result(payload);
      break;
    }
    case "fake-message": {
      messages.value.push({ role: "user", content: payload });

      scrollToBottom();
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
    vscode.postMessage({ to: "vscode", command: "env", payload: "apiKey" } as VscodeEnvRequest);
  }
});

onUnmounted(() => {
  if (typeof vscode !== "undefined") {
    window.removeEventListener("message", vscodeListener);
  }
});

// messages and status - Updated to use AI SDK compatible types
const messages = ref<(UserMessageType | AssistantMessageType | ToolCallMessageType)[]>([]);
const status = ref<{
  state: "ready" | "chatting";
  pendingToolCalls: Map<string, { id: string; name: string; args: string }>;
}>({
  state: "ready",
  pendingToolCalls: new Map(),
});
const index = ref(-1);
const controller: Ref<AbortController | undefined> = ref(undefined);

const tool$call$result = async (payload: VscodeToolCallResult["payload"]) => {
  messages.value.push({ role: "tool-call", id: payload.id, name: payload.name, result: payload.result });

  // 收到某个工具执行结果后，从待处理列表中移除
  status.value.pendingToolCalls.delete(payload.id);

  scrollToBottom();

  // 仅当所有工具调用都处理完成后，再继续对话
  if (status.value.pendingToolCalls.size === 0) {
    await init(JSON.parse(JSON.stringify(unref(messages))));
  }
};

const send = async (content: string) => {
  if (content.trim() === "" || status.value.state !== "ready") {
    console.error("unready or empty content");
    return;
  }

  if (status.value.pendingToolCalls.size !== 0) {
    // 处理未完成的工具调用
    for (const [_, toolCall] of status.value.pendingToolCalls) {
      messages.value.push({ role: "tool-call", ...toolCall, result: "用户选择放弃此次工具调用，完成对话" });
    }

    status.value.pendingToolCalls.clear();
  }

  messages.value.push({ role: "user", content: content.trim() });

  scrollToBottom();

  await init(JSON.parse(JSON.stringify(unref(messages))));
};

// post message from vscode to webview

const start = (_payload: VscodeChatStart["payload"]) => {
  index.value = messages.value.push({ role: "assistant" }) - 1;
  status.value.state = "chatting";
  scrollToBottom();
};

const chunk = (payload: VscodeChatDelta["payload"]) => {
  const curr = messages.value[index.value];

  // 安全检查：确保当前消息存在且是assistant类型
  if (!curr || curr.role !== "assistant") {
    console.warn("Invalid current message for chunk:", payload);
    return;
  }

  switch (payload.type) {
    case "reasoning-delta": {
      curr.reasoning = (curr.reasoning || "") + payload.text;
      break;
    }
    case "text-delta": {
      curr.content = (curr.content || "") + payload.text;
      break;
    }
    case "tool-call": {
      if (!curr.toolcall) {
        curr.toolcall = {};
      }
      curr.toolcall[payload.id] = {
        ...payload,
      };
      // 记录待处理的工具调用
      status.value.pendingToolCalls.set(payload.id, {
        id: payload.id,
        name: payload.name,
        args: payload.args,
      });
      break;
    }
    case "tool-call-delta": {
      // 处理工具调用状态更新，用于显示转圈效果
      if (!curr.toolcall) {
        curr.toolcall = {};
      }
      curr.toolcall[payload.id] = {
        name: payload.name || "processing",
        args: payload.args || "正在处理...",
        status: "processing", // 添加状态标识
      };
      break;
    }
  }
  scrollToBottom();
};

const finish = (_payload: VscodeChatFinish["payload"]) => {
  status.value.state = "ready";
  index.value = -1;
};

const error = (payload: VscodeChatError["payload"]) => {
  const last = messages.value[index.value];
  if (last.role === "assistant") {
    last.content = payload;
  }

  status.value.state = "ready";
  index.value = -1;
};

// post message from webview to vscode

const init = async (payload: VscodeChatInit["payload"]) => {
  if (vscode !== undefined) {
    vscode.postMessage({ to: "vscode", command: "chat.init", payload } as VscodeChatInit);
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
            if (!curr.toolcall) {
              curr.toolcall = {};
            }
            curr.toolcall[event.chunk.toolCallId] = {
              name: event.chunk.toolName,
              args: JSON.stringify(event.chunk.input),
            };
            console.log(curr.toolcall);
            // 记录待处理的工具调用（开发模式）
            status.value.pendingToolCalls.set(event.chunk.toolCallId, {
              id: event.chunk.toolCallId,
              name: event.chunk.toolName,
              args: JSON.stringify(event.chunk.input),
            });
            break;
          }
        }
        scrollToBottom();
      },
      onFinish: () => finish(),
      onError: (e) => error(String(e.error)),
    });

    for await (const part of client.fullStream) {
      if (part.type === "start") {
        start();
      }
    }
  }
};

const abort = (payload: VscodeChatAbort["payload"]) => {
  if (vscode !== undefined) {
    vscode.postMessage({ to: "vscode", command: "chat.abort", payload } as VscodeChatAbort);
  } else {
    controller.value?.abort();
  }
  status.value.state = "ready";
};

const tool$call = (payload: VscodeToolCall["payload"]) => {
  if (vscode !== undefined) {
    vscode.postMessage({ to: "vscode", command: "tool-call", payload } as VscodeToolCall);
  } else {
    // nothing to do
  }
};

const cancelToolCall = (payload: VscodeToolCall["payload"]) => {
  // 取消某个工具调用并从待处理列表中移除
  status.value.pendingToolCalls.delete(payload.id);

  messages.value.push({
    role: "tool-call",
    result: "用户选择放弃此次工具调用，完成对话",
    ...payload,
  });

  // 所有待处理清空后，继续对话
  if (status.value.pendingToolCalls.size === 0) {
    init(JSON.parse(JSON.stringify(unref(messages))));
  }
};

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