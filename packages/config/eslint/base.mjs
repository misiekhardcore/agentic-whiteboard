import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

const TYPESCRIPT_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

const IGNORED = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/coverage/**",
  "**/playwright-report/**",
  "**/test-results/**",
  "**/blob-report/**",
  "**/next-env.d.ts",
  "**/drizzle/**",
];

/**
 * The one lint preset every package uses. A package's `eslint.config.mjs` calls
 * this with its own `tsconfigRootDir`, so type-aware rules resolve the package's
 * tsconfig and nothing has to copy the rule list.
 */
export function createConfig({ tsconfigRootDir, extra = [] }) {
  return tseslint.config(
    { ignores: IGNORED },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
      ...config,
      files: TYPESCRIPT_FILES,
    })),
    {
      files: TYPESCRIPT_FILES,
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: { "import-x": importX },
      rules: {
        "import-x/no-duplicates": "error",
        "import-x/order": [
          "error",
          {
            groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
            "newlines-between": "always",
            alphabetize: { order: "asc", caseInsensitive: true },
          },
        ],
      },
    },
    ...extra,
    eslintConfigPrettier,
  );
}
