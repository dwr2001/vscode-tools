<script setup lang="ts">
import { marked } from "marked";
import { onMounted, onUnmounted, ref, watchEffect } from "vue";
import { AMessage } from "../App.vue";
import MessageBubble from "./MessageBubble.vue";

const { content, reasoning_content, status } = defineProps<{
  content: string;
  reasoning_content: string;
  status: AMessage["status"];
}>();

const dots = ref("");
let intervalId: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  if (status === "thinking") {
    intervalId = setInterval(() => {
      dots.value = dots.value.length < 3 ? `${dots.value}.` : "";
    }, 500);
  }
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});

watchEffect(() => {
  if (status !== "thinking" && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    dots.value = "";
  }
});
</script>

<template>
  <MessageBubble role="assistant">
    <details v-if="reasoning_content" class="reasoning-details">
      <summary class="reasoning-summary">
        思考
        <span class="dots">{{ dots }}</span>
      </summary>
      <div
        v-html="marked(reasoning_content)"
      />
    </details>
    <div
      v-if="content"
      v-html="marked(content)"
    />
  </MessageBubble>
</template>

<style scoped>
.reasoning-details {
  padding: 0.25rem;
  border-bottom: 2px dashed color-mix(in srgb, var(--vscode-widget-border, green) 50%, transparent);
}

.reasoning-summary {
  cursor: pointer;
  color: var(--vscode-editor-foreground);
}

.dots {
  margin-right: 0.5rem;
}

</style>
