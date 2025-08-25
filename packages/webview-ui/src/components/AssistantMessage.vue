<script setup lang="ts">
import { AssistantMessageType, CREATE_FILE, CREATE_FILE_PARAMETERS, VscodeToolCall } from "@vscode-tools/protocol";
import { marked } from "marked";
import MessageBubble from "./MessageBubble.vue";
import CreateFile from "./tools/CreateFile.vue";
import vscButton from "./ui/vsc-button.vue";
import vscDetails from "./ui/vsc-details.vue";
import { ref } from "vue";

const { message } = defineProps<{ message: AssistantMessageType }>();

const toggle = ref(false);

const emits = defineEmits<{
  (e: "execute", args: VscodeToolCall["payload"]): void;
  (e: "cancel", args: VscodeToolCall["payload"]): void;
  (e: "retry", id: string): void;
}>();
</script>

<template>
  <MessageBubble role="assistant">
    <vsc-details v-if="message.reasoning" open>
      <template #icon>
        <i class="codicon codicon-lightbulb" />
      </template>
      <template #summary>
        思考
      </template>
      <div v-html="marked(message.reasoning)" />
    </vsc-details>

    <div v-if="message.content" v-html="marked(message.content)" />

    <div class="tool-dialog" v-for="(tool, id) in message.toolcall" :key="id">
      <span>
        {{ tool.name }}
        <i v-if="toggle" class="codicon codicon-check" />
      </span>

      <!-- 显示处理状态 -->
      <div v-if="tool.status === 'processing'" class="processing-status">
        <i class="codicon codicon-loading codicon-modifier-spin" />
        <span>正在处理...</span>
      </div>
      <template v-else>
        <CreateFile v-if="tool.name === CREATE_FILE" :args="(JSON.parse(tool.args) as CREATE_FILE_PARAMETERS)" />
        <div class="tool-actions" v-if="toggle === false && tool.status !== 'processing'">
          <vsc-button 
            @click="() => { emits('execute', { id, ...tool }); toggle = true; }"
          >
            <i class="codicon codicon-play" />
          </vsc-button>
          
          <vsc-button 
            @click="() => { emits('cancel', { id, ...tool }); toggle = true; }"
          >
            <i class="codicon codicon-stop" />
          </vsc-button>
        </div>
      </template>
    </div>
  </MessageBubble>
</template>


<style scoped>
.tool-dialog {
  border: 1px solid var(--vscode-widget-border);
  border-radius: 2px;
  margin-bottom: 0.75rem;
  background-color: color-mix(in srgb, var(--vscode-editor-background) 50%, transparent);
  overflow: hidden;
}

.tool-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: color-mix(in srgb, var(--vscode-editor-background) 60%, transparent);
}

.processing-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: color-mix(in srgb, var(--vscode-editor-background) 60%, transparent);
  color: var(--vscode-descriptionForeground);
  font-style: italic;
}

.processing-status i {
  color: var(--vscode-progressBar-background);
}
</style>