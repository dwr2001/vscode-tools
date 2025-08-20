import { defineConfig } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";

export default defineConfig({
  plugins: [pluginVue()],
  output: {
    manifest: true,
    inlineStyles: true,
  },
  server: {
    cors: {
      origin: "*",
    },
  },
  source: {
    define: {
      "process.env.USE_VSCODE": process.env.USE_VSCODE,
    },
  },
});
