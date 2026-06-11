import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  pack: {
    entry: ["src/index.ts", "src/worker/client.ts", "src/worker/host.ts"],
    dts: true,
    exports: true,
    format: ["esm"],
    sourcemap: true,
  },

  test: {
    include: ["tests/**/*.test.ts"],
    reporters: ["tree"],
  },
});
