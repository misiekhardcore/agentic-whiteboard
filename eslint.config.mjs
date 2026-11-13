import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import importX from "eslint-plugin-import-x";
import playwright from "eslint-plugin-playwright";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsFiles = ["**/*.{ts,tsx,mts,cts}"];
const testFiles = ["**/*.test.{ts,tsx}"];
const e2eFiles = ["e2e/**/*.ts"];

export default defineConfig([
  globalIgnores([
    // Next.js build output and generated types.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Git worktrees checked out inside the repo are separate projects.
    ".worktrees/**",
    // Generated database migrations and their Drizzle snapshots.
    "drizzle/**",
    // Vendored third-party documents and the local Supabase stack.
    ".agents/**",
    "supabase-project/**",
    "public/**",
    "playwright-report/**",
    "test-results/**",
  ]),

  js.configs.recommended,

  // Layer order matters: Next's configs must come before the overrides below,
  // because `eslint-config-next/typescript` ends with a `no-unused-vars: warn`
  // override that would otherwise downgrade the strict rule configuration.
  ...nextVitals,
  ...nextTypeScript,

  {
    files: tsFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },

  {
    files: tsFiles,
    plugins: {
      "import-x": importX,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "all",
          caughtErrors: "all",
          ignoreRestSiblings: false,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          reportUsedIgnorePattern: true,
        },
      ],
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      // Stripe's event union is huge and grows with the API; the webhook only
      // handles the events it mirrors and deliberately ignores the rest.
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],

      // `eslint-plugin-import` still uses APIs removed in ESLint 10, so the
      // maintained flat-config fork is used for import ordering and duplicates.
      "import-x/no-duplicates": "error",
      "import-x/order": [
        "error",
        {
          groups: [
            ["builtin", "external"],
            "internal",
            "parent",
            ["sibling", "index"],
            "object",
            "unknown",
          ],
          pathGroups: [{ pattern: "@/**", group: "internal", position: "before" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          distinctGroup: false,
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          named: {
            enabled: true,
            import: true,
            export: false,
            require: false,
            types: "mixed",
          },
        },
      ],
    },
  },

  {
    files: testFiles,
    extends: [vitest.configs.recommended],
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
  },

  {
    files: e2eFiles,
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      // The suite deliberately branches on what the environment provides
      // (Stripe test keys, optional third-party form fields) and skips the
      // checkout spec with an explicit reason when they are missing.
      "playwright/no-conditional-in-test": "off",
      "playwright/no-skipped-test": "off",
    },
  },

  {
    // Tooling scripts and config files run in Node outside the TS project.
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Must stay last: disables rules that conflict with Prettier.
  prettierRecommended,
]);
