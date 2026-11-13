const config = {
  // A change to one TypeScript file can break another, so typecheck the whole
  // project rather than the staged slice.
  "**/*.{ts,tsx,mts}": () => "tsc --noEmit",

  // Lint then format the staged source and tooling files.
  "**/*.{ts,tsx,mts,js,mjs,cjs}": ["eslint --fix --max-warnings=0", "prettier --write"],

  // Format everything else Prettier owns.
  "**/*.{css,json,md,yml,yaml}": ["prettier --write"],
};

export default config;
