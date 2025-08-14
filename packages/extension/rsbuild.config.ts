import { defineConfig } from "@rsbuild/core";

export default defineConfig({
  output: {
    copy: [
      {
        from: "../webview-ui/dist",
        to: "webview-ui",
        globOptions: {
          ignore: ["**/*.LICENSE.txt"],
        },
      },
    ],
    externals: ["vscode"],
    filenameHash: false,
    target: "node",
  },
  source: {
    entry: {
      extension: "./src/extension.ts",
    },
  },
});
