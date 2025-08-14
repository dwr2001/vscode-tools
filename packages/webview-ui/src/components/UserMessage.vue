<script setup lang="ts">
import { marked } from "marked";
import MessageBubble from "./MessageBubble.vue";

const { content } = defineProps<{ content: string }>();
</script>

<template>
  <MessageBubble role="user">
    <div v-html="marked(content)" />
  </MessageBubble>
</template>