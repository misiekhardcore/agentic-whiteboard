import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The package's promise is that it is a pure verifier: a signed token becomes an
 * `Actor`, and nothing else. A session store, database client or framework
 * import here would make the room owner and the agent service depend on the web
 * app, so the boundary is asserted rather than remembered.
 */
const SOURCE = import.meta.dirname;

const ALLOWED_DEPENDENCIES = ["@v2/contracts", "jose"];

/** Imports that would put a runtime, a database or a framework in the kernel. */
const FORBIDDEN_IMPORTS = [
  /from\s+"next(\/|")/,
  /from\s+"next-[a-z-]+"/,
  /from\s+"better-auth(\/|")/,
  /from\s+"react(\/|")/,
  /from\s+"pg"/,
  /from\s+"drizzle-orm/,
  /from\s+"@v2\/db"/,
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return entry.endsWith(".ts") && !entry.endsWith(".test.ts") ? [path] : [];
  });
}

describe("@v2/identity", () => {
  it("imports no framework, database client or app package", () => {
    const files = sourceFiles(SOURCE);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const path = relative(SOURCE, file);

      return FORBIDDEN_IMPORTS.filter((pattern) => pattern.test(source)).map(
        (pattern) => `${path}: ${String(pattern)}`,
      );
    });

    expect(offenders).toEqual([]);
  });

  it("declares only the contracts and the JWT library as dependencies", () => {
    const manifest = JSON.parse(readFileSync(join(SOURCE, "../package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(ALLOWED_DEPENDENCIES);
  });
});
