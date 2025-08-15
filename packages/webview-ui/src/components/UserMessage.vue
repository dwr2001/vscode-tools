<script setup lang="ts">
import { marked } from "marked";
import MessageBubble from "./MessageBubble.vue";

export type UserMessageType = {
  role: "user";
  content: string;
};

const { message } = defineProps<{ message: UserMessageType }>();
</script>

<template>
  <MessageBubble role="user">
    <div v-html="marked(message.content)" />
  </MessageBubble>
</template>