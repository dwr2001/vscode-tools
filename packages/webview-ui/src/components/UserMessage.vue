<script setup lang="ts">
import { UserMessageType } from "@vscode-tools/protocol";
import { marked } from "marked";
import MessageBubble from "./MessageBubble.vue";

const { message } = defineProps<{ message: UserMessageType }>();
</script>

<template>
  <MessageBubble role="user">
    <div v-html="marked(message.content)" />
  </MessageBubble>
</template>