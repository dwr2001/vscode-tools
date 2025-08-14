<template>
  <header style="
      flex: 0 0 auto;
      padding: 8px;
    "
  >
  </header>
  <main ref="mainContainer" style="
      flex: 1 1 auto;
      overflow-y: auto;
      box-sizing: border-box;
    ">
    <template v-for="(msg, i) in messages" :key="i">
      <UserMessage v-if="msg.role === 'user'" :content="msg.content" />
      <AssistantMessage v-else-if="msg.role === 'assistant'" :content="msg.content"
        :reasoning_content="msg.reasoning_content" :status="msg.status" />
    </template>
  </main>
  <footer style="flex: 0 0 auto;">
    <button class="clear-history-button" style="width: 100%;" @click="messages = []">清除历史</button>
    <Sender :status="status" @submit="send" @cancel="cancel" />
  </footer>
</template>

<script setup lang="ts">
import type { WebviewApi } from "vscode-webview";
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import Sender from "./Sender.vue";
import SSEClientWithThinkTag from "./api";
import AssistantMessage from "./components/AssistantMessage.vue";
import UserMessage from "./components/UserMessage.vue";

// system setup

type VscodeEnv = {
  command: "xiaoke.webview.env";
  payload: { key: string; value: unknown | undefined };
};

type VscodeChatOpen = {
  command: "xiaoke.webview.chat.open";
  payload: Response;
};

type VscodeChatMessage = {
  command: "xiaoke.webview.chat.message";
  payload: { type: "thinking" | "answering"; buffer: string };
};

type VscodeChatClose = {
  command: "xiaoke.webview.chat.close";
  payload: undefined;
};

type VscodeChatError = {
  command: "xiaoke.webview.chat.error";
  payload: unknown;
};

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

const vscodeListener = async (
  event: MessageEvent<VscodeEnv | VscodeChatOpen | VscodeChatMessage | VscodeChatClose | VscodeChatError>,
) => {
  const { command, payload } = event.data;
  console.debug("VSCode Listener Received message:", command, payload);

  switch (command) {
    case "xiaoke.webview.env": {
      if (payload.key === "baseURL" && typeof payload.value === "string") {
        console.log("baseURL:", payload.value);
        baseURL.value = payload.value;
      } else if (payload.key === "thinkTag" && typeof payload.value === "boolean") {
        console.log("thinkTag:", payload.value);
        thinkTag.value = payload.value;
      }
      break;
    }
    case "xiaoke.webview.chat.open": {
      await open(payload);
      break;
    }
    case "xiaoke.webview.chat.message": {
      message(payload.type, payload.buffer);
      break;
    }
    case "xiaoke.webview.chat.close": {
      close();
      break;
    }
    case "xiaoke.webview.chat.error": {
      error(payload);
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
      command: "xiaoke.webview.env",
      payload: { key: "baseURL" },
    });
    vscode.postMessage({
      command: "xiaoke.webview.env",
      payload: { key: "thingTag" },
    });
  }
});

onUnmounted(() => {
  if (typeof vscode !== "undefined") {
    window.removeEventListener("message", vscodeListener);
  }
});

// messages and status

export type AMessage = {
  role: "assistant";
  content: string;
  reasoning_content: string;
  status: "thinking" | "answering" | "completed";
};
export type UMessage = { role: "user"; content: string };

const messages = ref<(UMessage | AMessage)[]>([]);
const status = ref<"ready" | "thinking" | "answering">("ready");
const index = ref(-1);

const open = async (response: Response) => {
  console.log(`SSE connection opened: ${response.ok}.`);
  status.value = thinkTag.value ? "thinking" : "answering";
  index.value =
    messages.value.push({
      role: "assistant",
      content: "",
      reasoning_content: "",
      status: thinkTag.value ? "thinking" : "answering",
    }) - 1;
  scrollToBottom();
};

const message = (type: "thinking" | "answering", buffer: string) => {
  switch (type) {
    case "thinking": {
      (messages.value[index.value] as AMessage).reasoning_content += buffer;
      break;
    }
    case "answering": {
      (messages.value[index.value] as AMessage).content += buffer;
      (messages.value[index.value] as AMessage).status = "answering";
      status.value = "answering";
      break;
    }
  }
  scrollToBottom();
};

const close = () => {
  console.log("SSE connection closed");
  (messages.value[index.value] as AMessage).status = "completed";
  status.value = "ready";
  index.value = -1;
};

const error = (error: unknown) => {
  console.log("SSE on Error:", error);

  if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === "assistant") {
    messages.value[messages.value.length - 1].content += `无法连接到服务器：${error}`;
    (messages.value[messages.value.length - 1] as AMessage).status = "completed";
  } else {
    messages.value.push({
      role: "assistant",
      content: `连接服务器错误：${error}`,
      reasoning_content: "",
      status: "completed",
    });
  }

  status.value = "ready";
  index.value = -1;
};

let client = new SSEClientWithThinkTag(baseURL.value, thinkTag.value, open, message, close, error);

async function cancel() {
  if (vscode !== undefined) {
    vscode.postMessage({ command: "xiaoke.webview.chat.cancel" });
  } else {
    await client.cancel();
  }
  status.value = "ready";
  if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === "assistant") {
    (messages.value[messages.value.length - 1] as AMessage).status = "completed";
  }
}

async function send(content: string) {
  if (content.trim() === "" || status.value !== "ready") {
    console.error("unready or empty content");
    return;
  }

  messages.value.push({ role: "user", content: content.trim() });

  scrollToBottom();

  if (vscode !== undefined) {
    vscode.postMessage({ command: "xiaoke.webview.chat.invoke", payload: content });
  } else {
    await client.invoke(content);
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