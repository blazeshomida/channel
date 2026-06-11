import { defineConfig } from "vite-plus";

import { fmt } from "./tooling/format";
import { lint } from "./tooling/lint";
import { tasks } from "./tooling/tasks";

export default defineConfig({
  fmt,
  lint,

  run: {
    tasks,
  },
});
