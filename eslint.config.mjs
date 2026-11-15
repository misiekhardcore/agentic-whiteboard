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

// Files a client component may import: they ship in the browser bundle, so a
// server-only package here either breaks the build or pulls it into the bundle.
const clientSafeFiles = [
  "lib/shared/**",
  "lib/capabilities/presentation.ts",
  "lib/capabilities/presentations.ts",
  "lib/workspace/status.ts",
  "lib/workspace/contracts.ts",
  "lib/workspace/forms.ts",
  "lib/workspace/presentation.ts",
  "lib/organizations/contracts.ts",
  "lib/identity/forms.ts",
  "lib/identity/redirect.ts",
  "lib/billing/plans.ts",
  "lib/ai/thread/parts.ts",
  "lib/ai/thread/composer.ts",
  "lib/ai/thread/read-aloud.ts",
];

const serverOnlyPackages = [
  "node_modules/next",
  "node_modules/drizzle-orm",
  "node_modules/pg",
  "node_modules/stripe",
  "node_modules/nodemailer",
  "node_modules/better-auth",
];

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
    // The path zones below match on resolved files. Node resolution alone cannot
    // follow `@/...` or an extensionless relative import, so without this resolver
    // `no-restricted-paths` silently allows every alias import it should refuse.
    settings: {
      "import-x/resolver": {
        typescript: { project: "./tsconfig.json", alwaysTryTypes: true },
        node: true,
      },
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
      // The layering contract from docs/architecture/module-boundaries.md.
      // lib/architecture.test.ts asserts the same direction by reading the
      // import lines, so a boundary breaks a build twice rather than by review.
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./lib",
              from: ["./app", "./components"],
              message: "lib is the domain and the application layer; it must not import the UI.",
            },
            {
              // A surface is reached through its workspace, which owns the
              // account scope and the archive flag. Depending on another
              // context here would recreate the cycle the split removed.
              target: ["./lib/doc", "./lib/canvas"],
              from: [
                "./lib/workspace",
                "./lib/identity",
                "./lib/organizations",
                "./lib/ai",
                "./lib/billing",
                "./lib/collab",
              ],
              message:
                "A content surface is reached through its workspace; it never depends on another context.",
            },
            {
              // The kernel's core declares, runs and describes a capability by
              // naming the actor contract and nothing else. `except` resolves
              // against the zone's `from`, so "./actor" allows exactly
              // lib/identity/actor.ts inside the identity restriction.
              target: [
                "./lib/capabilities/define.ts",
                "./lib/capabilities/invoke.ts",
                "./lib/capabilities/describe.ts",
              ],
              from: [
                "./lib/workspace",
                "./lib/doc",
                "./lib/canvas",
                "./lib/organizations",
                "./lib/ai",
                "./lib/billing",
                "./lib/collab",
                "./lib/notifications",
              ],
              message:
                "The capability kernel knows the actor contract and nothing else about the domain.",
            },
            {
              target: [
                "./lib/capabilities/define.ts",
                "./lib/capabilities/invoke.ts",
                "./lib/capabilities/describe.ts",
              ],
              from: ["./lib/identity"],
              except: ["./actor.ts"],
              message:
                "The capability kernel knows the actor contract and nothing else about the domain.",
            },
            {
              target: clientSafeFiles,
              from: serverOnlyPackages,
              message:
                "A client-safe module ships to the browser; keep server-only packages out of it.",
            },
            {
              // The same rule, one step further in: importing the database
              // adapter reaches `pg` through it, even though this file never
              // names a server package. `from` must stay all-globs here, which
              // is why it is a separate zone from the package one above.
              target: clientSafeFiles,
              from: ["./lib/db/**"],
              message:
                "A client-safe module ships to the browser; keep server-only packages out of it.",
            },
          ],
        },
      ],
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
