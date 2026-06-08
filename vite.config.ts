import { defineConfig } from "vite-plus";

interface WorkspacePattern {
  pattern: string;
  base: "workspace";
}

type TaskInput = { auto: true } | string | WorkspacePattern;

/**
 * Creates a workspace-root-relative file pattern.
 *
 * Use this for task inputs or outputs that should be resolved from the
 * workspace root instead of the task package directory. This is especially
 * useful when one package depends on generated files from another package.
 */
function workspacePattern(pattern: string): WorkspacePattern {
  return {
    pattern,
    base: "workspace",
  };
}

/**
 * Creates the default cache input set for workspace tasks.
 *
 * Automatic input tracking keeps task cache keys accurate without manually
 * listing every source/config file. The exclusions remove generated or
 * tool-owned files that can be read and rewritten during a task, which would
 * otherwise make Vite+ reject the cache entry as unstable.
 */
function workspaceInput(...inputs: WorkspacePattern[]): TaskInput[] {
  return [
    { auto: true },
    "!**/node_modules/**",
    "!**/.vite/**",
    "!**/.vite-temp/**",
    "!**/coverage/**",
    "!**/dist/**",
    ...inputs,
  ];
}

/**
 * Creates a workspace-root-relative output pattern.
 *
 * Use this for task outputs that Vite+ should restore on cache hits, such as
 * package `dist` files or playground build artifacts.
 */
function workspaceOutput(pattern: string): WorkspacePattern[] {
  return [workspacePattern(pattern)];
}

export default defineConfig({
  fmt: {
    ignorePatterns: ["dist", "coverage"],
  },

  lint: {
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],

    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },

    options: {
      typeAware: true,
      typeCheck: true,
    },
  },

  run: {
    tasks: {
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
        command: "vp test",
        cwd: "packages/channel",
        input: workspaceInput(),
      },

      "task:workspace:check": {
        command: "vp check",
        dependsOn: ["task:channel:pack"],
      },

      "task:vanilla:build": {
        command: "vp build",
        cwd: "playgrounds/vanilla",
        dependsOn: ["task:channel:pack"],
        input: workspaceInput(workspacePattern("packages/channel/dist/**")),
        output: workspaceOutput("playgrounds/vanilla/dist/**"),
      },

      "task:vanilla:dev": {
        command: "vp dev",
        cwd: "playgrounds/vanilla",
        dependsOn: ["task:channel:pack"],
        cache: false,
      },

      "task:ready": {
        command: [
          "vp run task:workspace:check",
          "vp run task:channel:test",
          "vp run task:vanilla:build",
        ],
      },
    },
  },
});
