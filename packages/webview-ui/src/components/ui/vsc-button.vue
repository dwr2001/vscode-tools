<script setup lang="ts">
const emits = defineEmits<(e: "click") => void>();
</script>

<template>
  <button class="vsc-button" @click="emits('click')">
    <slot />
    <slot name="icon" />
  </button>
</template>

<style lang="css" scoped>
.vsc-button {
  display: flex;
  background-color: var(--vscode-button-background);
  border: 1px solid var(--vscode-button-border, black);
  color: var(--vscode-button-foreground);
  align-self: flex-end;
  border-radius: 2px;
  cursor: pointer;
  margin-top: 0.25rem;

  &:hover {
    background-color: var(--vscode-button-hoverBackground);
    border: 1px solid var(--vscode-focusBorder, darkgrey);
    color: var(--vscode-focusBorder, darkgrey);
  }
}
</style>