import type { UserConfig } from "vite-plus";

import { outputPatterns } from "./patterns";

export const fmt = {
  ignorePatterns: outputPatterns,

  sortImports: {
    internalPattern: ["#/"],
  },
} satisfies NonNullable<UserConfig["fmt"]>;
