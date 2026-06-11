import type { UserConfig } from "vite-plus";

import { generatedPatterns, localToolPatterns, outputPatterns } from "./patterns";

type LintConfig = NonNullable<UserConfig["lint"]>;
type LintOptions = NonNullable<LintConfig["options"]>;

const plugins = ["eslint", "typescript", "unicorn", "oxc"] satisfies NonNullable<
  LintConfig["plugins"]
>;

export const lint = {
  plugins,

  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn",
  },

  env: {
    es2022: true,
    node: true,
  },

  ignorePatterns: [...outputPatterns, ...localToolPatterns, ...generatedPatterns],

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
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  } satisfies LintOptions,
} satisfies LintConfig;
