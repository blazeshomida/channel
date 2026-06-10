export interface WorkspacePattern {
  pattern: string;
  base: "workspace";
}

export type TaskInput = { auto: true } | string | WorkspacePattern;

/**
 * Creates a workspace-root-relative file pattern.
 *
 * Use this for task inputs or outputs that should be resolved from the
 * workspace root instead of the task package directory. This is especially
 * useful when one package depends on generated files from another package.
 */
export function workspacePattern(pattern: string): WorkspacePattern {
  return {
    pattern,
    base: "workspace",
  };
}

/**
 * Creates a workspace-root-relative output pattern.
 *
 * Use this for task outputs that Vite+ should restore on cache hits, such as
 * package `dist` files or playground build artifacts.
 */
export function workspaceOutput(pattern: string): WorkspacePattern[] {
  return [workspacePattern(pattern)];
}

export const dependencyPatterns = ["node_modules", ".vite", ".vite-temp"];

/**
 * Output directories are tool-owned and can be deleted or recreated by tasks.
 * They should be ignored as independent task cache inputs.
 */
export const outputPatterns = ["dist", "coverage"];

/**
 * Creates ignored glob patterns for a directory.
 *
 * Vite+ task input globs can be resolved from package working directories, so
 * exclude both the directory itself and every nested file under it.
 */
export function ignoredDirectoryInput(pattern: string): string[] {
  return [`!**/${pattern}`, `!**/${pattern}/**`];
}
