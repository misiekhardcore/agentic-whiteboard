import { defineConfig } from "vitest/config";

/**
 * The one Vitest preset. Packages extend it instead of restating the runner
 * options, so a change to how tests run lands everywhere at once.
 */
export function createVitestConfig(options: { include?: string[] } = {}) {
  return defineConfig({
    test: {
      environment: "node",
      include: options.include ?? ["src/**/*.test.ts", "test/**/*.test.ts"],
      passWithNoTests: false,
    },
  });
}
