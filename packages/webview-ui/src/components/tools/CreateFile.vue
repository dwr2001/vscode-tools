<template>
  <div>
    <strong>文件路径：</strong>
    <span>{{ args.filepath }}</span>
  </div>
</template>

<script lang="ts" setup>
import { CREATE_FILE_PARAMETERS } from "@vscode-tools/protocol";

const { args } = defineProps<{ args: CREATE_FILE_PARAMETERS }>();
</script>
