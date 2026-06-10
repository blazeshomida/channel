import type { UserConfig } from "vite-plus";

import {
  dependencyPatterns,
  ignoredDirectoryInput,
  outputPatterns,
  type TaskInput,
  workspaceOutput,
  workspacePattern,
} from "./patterns";

type TasksConfig = NonNullable<NonNullable<UserConfig["run"]>["tasks"]>;

/**
 * Creates the default cache input set for workspace tasks.
 *
 * Automatic input tracking keeps task cache keys accurate without manually
 * listing every source/config file. The exclusions remove dependency, output,
 * and tool-owned paths that can be read and rewritten during a task.
 */
function workspaceInput(...inputs: TaskInput[]): TaskInput[] {
  return [
    { auto: true },
    ...dependencyPatterns.flatMap(ignoredDirectoryInput),
    ...outputPatterns.flatMap(ignoredDirectoryInput),
    ...inputs,
  ];
}

export const tasks = {
  "task:channel:pack": {
    command: "vp pack",
    cwd: "packages/channel",
    input: workspaceInput(),
    output: workspaceOutput("packages/channel/dist/**"),
  },

  "task:channel:dev": {
    command: "vp pack --watch",
    cwd: "packages/channel",
    cache: false,
  },

  "task:channel:test": {
    command: "vp test packages/channel",
    input: workspaceInput(),
  },

  "task:workspace:check": {
    command: "vp check",
    dependsOn: ["task:channel:pack"],
  },

  "task:vanilla:build": {
    command: "vp build playgrounds/vanilla",
    dependsOn: ["task:channel:pack"],
    input: workspaceInput(workspacePattern("packages/channel/dist/**")),
    output: workspaceOutput("playgrounds/vanilla/dist/**"),
  },

  "task:vanilla:dev": {
    command: "vp dev playgrounds/vanilla",
    dependsOn: ["task:channel:pack"],
    cache: false,
  },

  "task:vanilla-workers:build": {
    command: "vp build playgrounds/vanilla-workers",
    dependsOn: ["task:channel:pack"],
    input: workspaceInput(workspacePattern("packages/channel/dist/**")),
    output: workspaceOutput("playgrounds/vanilla-workers/dist/**"),
  },

  "task:vanilla-workers:dev": {
    command: "vp dev playgrounds/vanilla-workers",
    dependsOn: ["task:channel:pack"],
    cache: false,
  },

  "task:ready": {
    command: [
      "vp run task:workspace:check",
      "vp run task:channel:test",
      "vp run task:vanilla:build",
      "vp run task:vanilla-workers:build",
    ],
  },
} satisfies TasksConfig;
