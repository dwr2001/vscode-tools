<script setup lang="ts">
import { marked } from "marked";
import MessageBubble from "./MessageBubble.vue";
import vscButton from "./ui/vsc-button.vue";
import vscDetails from "./ui/vsc-details.vue";

export type AssistantMessageType = {
  role: "assistant";
  content?: string;
  reasoning?: string;
  toolcall?: Record<string, { name: string; args: unknown }>;
};

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
      <div
        v-html="marked(message.reasoning)"
        class="reasoning-content"
      />
    </vsc-details>

    <div v-if="message.content" v-html="marked(message.content)" />

    <div class="tool-dialog" v-for="(tool, id) in message.toolcall" :key="id">
      <span class="tool-name">{{ tool.name }}</span>
      
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
  border-radius: 8px;
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