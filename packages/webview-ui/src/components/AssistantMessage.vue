<script setup lang="ts">
import { AssistantMessageType, CREATE_FILE, CREATE_FILE_PARAMETERS } from "@vscode-tools/protocol";
import { marked } from "marked";
import MessageBubble from "./MessageBubble.vue";
import CreateFile from "./tools/CreateFile.vue";
import vscButton from "./ui/vsc-button.vue";
import vscDetails from "./ui/vsc-details.vue";

const { message } = defineProps<{ message: AssistantMessageType }>();

const emits = defineEmits<{
  (e: "execute", id: string, name: string, args: unknown): void;
  (e: "cancel", id: string): void;
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
      <span>{{ tool.name }}</span>

      <CreateFile v-if="tool.name === CREATE_FILE" :args="(tool.args as CREATE_FILE_PARAMETERS)" />

      <div class="tool-actions">
        <vsc-button 
          @click.once="emits('execute', id, tool.name, tool.args)"
        >
          <i class="codicon codicon-play" />
        </vsc-button>
        
        <vsc-button 
          @click="emits('cancel', id)"
        >
          <i class="codicon codicon-stop" />
        </vsc-button>
      </div>
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
</style>