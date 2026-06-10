import type { UserConfig } from "vite-plus";

export const test = {
  reporters: ["tree"],
} satisfies NonNullable<UserConfig["test"]>;
