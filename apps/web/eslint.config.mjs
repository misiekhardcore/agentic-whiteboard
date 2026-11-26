import { createConfig } from "@v2/config/eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  extra: [...nextVitals, ...nextTypeScript],
});
