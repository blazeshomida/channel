import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/worker/client.ts", "src/worker/host.ts"],
    dts: true,
    exports: true,
  },
});
