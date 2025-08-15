<template>
  <div
    style="
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    "
  >
    <textarea
      @input="adjustHeight"
      @keydown.enter.prevent="send"
      ref="textareaRef"
      rows="2"
      class="sender-textarea"
      :style="{ height: height }"
      v-model="input"
    />
    <vsc-button
      v-if="status === 'ready'"
      @click="send"
    >
      <i class="codicon codicon-send" />
    </vsc-button>
    <vsc-button
      v-else
      @click="emits('cancel')"
    >
      <i class="codicon codicon-stop-circle" />
    </vsc-button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import VscButton from "./components/ui/vsc-button.vue";

const { status } = defineProps<{
  status: "ready" | "reasoning" | "text";
}>();

const input = ref("");
const height = ref("auto");

const emits = defineEmits<{
  (e: "submit", content: string): void;
  (e: "cancel"): void;
}>();

function adjustHeight(event: Event) {
  height.value = "auto";
  const textarea = event.target as HTMLTextAreaElement | null;
  if (textarea) {
    nextTick(() => {
      height.value = `${textarea.scrollHeight}px`;
    });
  }
}

const send = () => {
  if (input.value.trim() === "") return;
  emits("submit", input.value);
  input.value = "";
  height.value = "auto";
};
</script>

<style scoped>
.sender-textarea {
  background-color: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, black);
  color: var(--vscode-input-foreground);
  resize: none;
  overflow-y: auto;
  max-height: calc(6 * 1.5em);
  word-wrap: break-word;
  overflow-wrap: break-word;
  box-sizing: border-box;
  width: 100%;
  border-radius: 2px;
  padding: 6px 8px;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 1px var(--vscode-focusBorder, black);
  }
}
</style>