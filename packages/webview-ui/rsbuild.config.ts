import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';

export default defineConfig({
  plugins: [pluginVue()],
  server: {
    cors: {
      origin: '*',
    },
  },
  source: {
    define: {
      "import.meta.env.USEVSCODE": JSON.stringify(process.env.USEVSCODE || "false"),
    }
  },
  output: {
    manifest: true
  }
});
