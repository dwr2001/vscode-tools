<script setup lang="ts">
const { open = false } = defineProps<{
  open: boolean;
}>();
</script>

<template>
  <details class="details" :open="open">
    <summary class="summary">
      <slot name="icon" />
      <slot name="summary" />
    </summary>
    <slot />
  </details>
</template>

<style lang="css" scoped>
.details {
  margin-bottom: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--vscode-widget-border) 50%, transparent);
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--vscode-editor-background) 20%, transparent);
}

.summary {
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.75rem;
  color: var(--vscode-editor-foreground);
  user-select: none;
  border-bottom: 1px solid var(--vscode-widget-border, green);
}

.summary:hover {
  background-color: color-mix(in srgb, var(--vscode-list-hoverBackground) 30%, transparent);
}

.summary .codicon-lightbulb {
  color: var(--vscode-symbolIcon-keywordForeground, #569CD6);
}
</style>