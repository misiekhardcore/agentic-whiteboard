import { createConfig } from "@v2/config/eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// The shared preset registers typescript-eslint's type-checked config. Next's
// core-web-vitals preset embeds a `next/typescript` layer that registers the
// same plugin from its own resolved instance, which flat config rejects as a
// redefinition. Keep the layer's parser and file scope, but let the shared
// preset own the plugin and its rules.
const nextCoreWebVitals = nextVitals.map((config) =>
  config.name === "next/typescript" ? { ...config, plugins: {} } : config,
);

const typeScriptParser = { ...nextTypeScript[0], plugins: {} };

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  // The base layer carries the TypeScript parser for every extension; the rest
  // of Next's TypeScript preset duplicates the shared rules and plugin.
  extra: [...nextCoreWebVitals, typeScriptParser],
});
