import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The layering contract, asserted instead of remembered.
 *
 * Lint zones cover the same rules for imports that resolve at build time; this
 * test exists because a dependency rule nobody can fail is a convention. It
 * reads the files rather than the bundle, so it also catches a module that is
 * only imported from a test or a route that is never built in this pass.
 *
 * Keep the lists explicit: a broad pattern quietly allows what it should not.
 */

const ROOT = join(import.meta.dirname, "..");
const LIB = join(ROOT, "lib");
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

function isTest(path: string): boolean {
  return /\.test\.tsx?$/.test(path);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))) return [];
    return isTest(path) ? [] : [path];
  });
}

const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

function importsOf(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1]);
}

function offendersIn(predicate: (file: string) => boolean, forbidden: RegExp[]): string[] {
  return sourceFiles(LIB)
    .filter(predicate)
    .flatMap((file) => {
      const label = relative(ROOT, file);
      return importsOf(file)
        .filter((specifier) => forbidden.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${label} imports ${specifier}`);
    });
}

/**
 * Files a client component may import. They ship in the browser bundle, so a
 * server import here either breaks the build or pulls `pg` into it.
 */
const CLIENT_SAFE = [
  /^lib[\\/]shared[\\/]/,
  /^lib[\\/]capabilities[\\/]presentations?[\\/]/,
  /^lib[\\/]workspace[\\/](status|contracts|forms|presentation)[\\/]/,
  /^lib[\\/]organizations[\\/]contracts[\\/]/,
  /^lib[\\/]identity[\\/]forms[\\/]/,
  /^lib[\\/]identity[\\/]redirect\.ts$/,
  /^lib[\\/]billing[\\/]plans[\\/]/,
  /^lib[\\/]ai[\\/]thread[\\/](parts|composer|read-aloud)[\\/]/,
];

const SERVER_ONLY = [
  /^next(\/|$)/,
  /^drizzle-orm/,
  /^pg$/,
  /^stripe$/,
  /^nodemailer$/,
  /^@\/lib\/db(\/|$)/,
];

/**
 * The kernel declares and runs capabilities. It knows the actor type and
 * nothing else about the domain, which is what lets every context use it
 * without the kernel depending on them.
 */
const KERNEL = [/^lib[\\/]capabilities[\\/](define|invoke|describe)[\\/]/];

// The kernel is now folders, so its own files import their siblings by relative
// path; every other module in `lib/capabilities` stays out of the allowlist.
const KERNEL_ALLOWED = [
  /^zod$/,
  /^\.\//,
  /^\.\.\/(define|invoke|presentation|changes)(\/|$)/,
  /^@\/lib\/capabilities\/(define|invoke|presentation|changes)(\/|$)/,
  /^@\/lib\/identity\/actor$/,
  // The change contract is vocabulary, not a domain: the kernel publishes it.
  /^@\/lib\/shared\/changes(\/|$)/,
];

/**
 * A workspace's content surfaces are read in the workspace context, which is the
 * only place that knows the account scope and the archive flag. A surface is
 * reachable exactly when its workspace is, so reading its table anywhere else
 * would need a second copy of that rule.
 */
const SURFACE_TABLES = ["docs", "canvases"];
const SCHEMA_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']@\/lib\/db\/schema["']/g;
const WORKSPACE_CONTEXT = /^lib[\\/]workspace[\\/]/;

/** The surface tables each module names when it imports the schema. */
function surfaceTablesImportedBy(path: string): string[] {
  const source = readFileSync(path, "utf8");

  return [...source.matchAll(SCHEMA_IMPORT)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((binding) => binding.trim().split(/\s+as\s+/)[0] ?? "")
      .filter((binding) => SURFACE_TABLES.includes(binding)),
  );
}

describe("module boundaries", () => {
  it("keeps lib out of the presentation layer", () => {
    expect(offendersIn(() => true, [/^@\/app(\/|$)/, /^@\/components(\/|$)/])).toEqual([]);
  });

  it("keeps a client-safe module free of server imports", () => {
    expect(
      offendersIn((file) => CLIENT_SAFE.some((pattern) => pattern.test(file)), SERVER_ONLY),
    ).toEqual([]);
  });

  it("reads the content surfaces only in the workspace context", () => {
    const readers = sourceFiles(LIB).filter((file) => surfaceTablesImportedBy(file).length > 0);

    // The rule is only worth anything while there is a read to apply it to.
    expect(readers.length).toBeGreaterThan(0);

    const external = readers.flatMap((file) => {
      const label = relative(ROOT, file);
      if (WORKSPACE_CONTEXT.test(label)) return [];

      return surfaceTablesImportedBy(file).map((table) => `${label} reads ${table}`);
    });

    expect(external).toEqual([]);
  });

  it("keeps the capability kernel free of domain knowledge", () => {
    const files = sourceFiles(LIB).filter((file) =>
      KERNEL.some((pattern) => pattern.test(relative(ROOT, file))),
    );

    expect(files.length).toBeGreaterThan(0);

    const external = files.flatMap((file) => {
      const label = relative(ROOT, file);
      return importsOf(file)
        .filter((specifier) => !KERNEL_ALLOWED.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${label} imports ${specifier}`);
    });

    expect(external).toEqual([]);
  });

  it("keeps capabilities free of routes and cache tags", () => {
    // `refresh()` is the one `next/cache` call a capability may make: it re-reads
    // the route the caller is on, so the kernel never names a path. Naming one,
    // or invalidating a tag, is the route knowledge this rule exists to keep out.
    const ALLOWED = ["refresh"];
    const offenders = sourceFiles(LIB)
      .filter((file) => /^lib[\\/]capabilities[\\/]/.test(relative(ROOT, file)))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const label = relative(ROOT, file);

        return [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']next\/cache["']/g)].flatMap(
          (match) =>
            match[1]
              .split(",")
              .map((name) => name.trim())
              .filter((name) => name.length > 0 && !ALLOWED.includes(name))
              .map((name) => `${label} imports ${name}`),
        );
      });

    expect(offenders).toEqual([]);
  });
});
