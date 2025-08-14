<template>
  <div
    :style="{ justifyContent: role === 'assistant' ? 'flex-start' : 'flex-end' }"
    style="display: flex; margin-bottom: 0.5rem"
  >
    <i
      v-if="role === 'assistant'"
      class="codicon codicon-robot"
      style="color: var(--vscode-icon-foreground); font-size: 24px; margin: 0.25rem"
    />
    <div class="message-content">
      <slot />
    </div>
    <i
      v-if="role === 'user'"
      name="avatar"
      class="codicon codicon-account"
      style="color: var(--vscode-icon-foreground); font-size: 24px; margin: 0.25rem"
    />
  </div>
</template>

<script setup lang="ts">
const { role } = defineProps<{
  role?: "user" | "assistant";
}>();
</script>

<style scoped>
.message-content {
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-widget-border, black);
  border-radius: 2px;
  word-break: break-word;
  padding: 0 0.75rem;
  flex: 1;
  max-width: calc(min(100% - 24px, 85%));
  overflow-x: auto;

  &:hover {
    border: 1px solid var(--vscode-focusBorder, darkgrey);
  }
}
</style>