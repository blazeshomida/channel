import type { UserConfig } from "vite-plus";

type LintConfig = NonNullable<UserConfig["lint"]>;

export const lint = {
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
} satisfies LintConfig;
