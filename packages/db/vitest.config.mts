import { createVitestConfig } from "@v2/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

/**
 * Each database suite boots its own PGlite and applies every migration. Run
 * side by side on a small machine they starve each other and a 5s test times
 * out while the migration itself is still running, so the files run one at a
 * time.
 */
export default mergeConfig(
  createVitestConfig(),
  defineConfig({ test: { fileParallelism: false } }),
);
