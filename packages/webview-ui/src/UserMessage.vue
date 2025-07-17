<template>
  <div class="user-message-container">
    <div class="user-message-content">
      <div v-html="markdowned_content" class="user-message-text" />
    </div>
    <i class="codicon codicon-account user-message-icon" />
  </div>
</template>

<script setup lang="ts">
import markdownit from 'markdown-it';
import { computed } from 'vue';

const { content } = defineProps<{ content: string }>();

const mdit = new markdownit();

const markdowned_content = computed(() => mdit.render(content));
</script>

<style scoped>
.user-message-container {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.user-message-content {
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

.user-message-text {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.user-message-icon {
  font-size: 24px;
  margin: 0.25rem;
  color: var(--vscode-icon-foreground);
}
</style>