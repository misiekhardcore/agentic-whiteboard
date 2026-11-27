import { defineConfig } from "vitest/config";

/**
 * The one Vitest preset. Packages extend it instead of restating the runner
 * options, so a change to how tests run lands everywhere at once.
 *
 * Plain ESM on purpose: packages import this through a workspace symlink, and
 * Node refuses to strip TypeScript for a file inside `node_modules`.
 *
 * @param {{ include?: string[] }} [options]
 */
export function createVitestConfig(options = {}) {
  return defineConfig({
    test: {
      environment: "node",
      include: options.include ?? ["src/**/*.test.ts", "test/**/*.test.ts"],
      passWithNoTests: false,
    },
  });
}
