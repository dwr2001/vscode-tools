<template>
  <div class="assistant-message-container">
    <i class="codicon codicon-robot assistant-message-icon" />
    <div class="assistant-message-content">
      <details v-if="reasoning_content" class="reasoning-details">
        <summary class="reasoning-summary">
          思考
          <span class="dots">{{ dots }}</span>
        </summary>
        <div
          v-if="markdowned_reasoning_content"
          v-html="markdowned_reasoning_content"
          class="reasoning-text"
        />
      </details>
      <div
        v-if="markdowned_content"
        v-html="markdowned_content"
        class="answering-text"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import markdownit from 'markdown-it';
import { computed, ref, watchEffect, onMounted, onUnmounted } from 'vue';
import { AssistantMessage } from './App.vue';
import markdownItCodeCopy from './markdown-it-code-copy';

const { content, reasoning_content, status } = defineProps<{
  content: string;
  reasoning_content: string;
  status: AssistantMessage['status'];
}>();

const mdit = new markdownit().use(markdownItCodeCopy);

const markdowned_content = computed(() => mdit.render(content));
const markdowned_reasoning_content = computed(() =>
  mdit.render(reasoning_content),
);

const dots = ref('');
let intervalId: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  if (status === 'thinking') {
    intervalId = setInterval(() => {
      dots.value = dots.value.length < 3 ? dots.value + '。' : '';
    }, 500);
  }
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});

watchEffect(() => {
  if (status !== 'thinking' && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    dots.value = '';
  }
});
</script>

<style scoped>
.assistant-message-container {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 0.5rem;
}

.assistant-message-icon {
  font-size: 24px;
  margin: 0 0.25rem;
  color: var(--vscode-icon-foreground);
}

.assistant-message-content {
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-widget-border, blue);
  border-radius: 2px;
  word-break: break-word;
  padding: 0 0.75rem;
  flex: 1;
  max-width: calc(min(100% - 24px, 85%));
  overflow-x: auto;

  &:hover {
    border: 1px solid var(--vscode-focusBorder, #f0f0f0);
  }
}

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

.reasoning-text {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.answering-text {
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
