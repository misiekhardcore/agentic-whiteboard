import { fileURLToPath } from "node:url";

import { createVitestConfig } from "@v2/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

// The app imports itself through `@/`, which Next resolves from tsconfig. A
// unit test that loads a route needs the same mapping.
export default mergeConfig(
  createVitestConfig(),
  defineConfig({
    resolve: {
      alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
  }),
);
