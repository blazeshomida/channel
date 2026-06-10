import { defineConfig } from "vite-plus";

import { fmt } from "./tooling/format";
import { lint } from "./tooling/lint";
import { tasks } from "./tooling/tasks";
import { test } from "./tooling/test";

export default defineConfig({
  fmt,
  lint,
  test,

  run: {
    tasks,
  },
});
