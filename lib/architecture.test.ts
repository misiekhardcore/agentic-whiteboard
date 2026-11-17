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
  /^lib[\\/]capabilities[\\/]presentations?\.ts$/,
  /^lib[\\/]workspace[\\/](status|contracts|forms|presentation)\.ts$/,
  /^lib[\\/]organizations[\\/]contracts\.ts$/,
  /^lib[\\/]identity[\\/](forms|redirect)\.ts$/,
  /^lib[\\/]billing[\\/]plans\.ts$/,
  /^lib[\\/]ai[\\/]thread[\\/](parts|composer|read-aloud)\.ts$/,
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
const KERNEL = [/^lib[\\/]capabilities[\\/](define|invoke|describe)\.ts$/];

const KERNEL_ALLOWED = [/^zod$/, /^\.\//, /^@\/lib\/identity\/actor$/];

/**
 * The content surfaces are leaves: each answers for its own rows, and the
 * workspace context decides which of them a person may see. They may use the
 * database and the shared primitives, and no other context.
 */
const SURFACE_CONTEXTS = [/^lib[\\/](doc|canvas)[\\/]/];

const SURFACE_ALLOWED = [
  /^@\/lib\/db(\/|$)/,
  /^@\/lib\/shared(\/|$)/,
  /^drizzle-orm/,
  /^\.\//,
  // A split module lives one folder down but still belongs to its surface.
  /^\.\.\/(contracts|queries)(\/|$)/,
];

describe("module boundaries", () => {
  it("keeps lib out of the presentation layer", () => {
    expect(offendersIn(() => true, [/^@\/app(\/|$)/, /^@\/components(\/|$)/])).toEqual([]);
  });

  it("keeps a client-safe module free of server imports", () => {
    expect(
      offendersIn((file) => CLIENT_SAFE.some((pattern) => pattern.test(file)), SERVER_ONLY),
    ).toEqual([]);
  });

  it("keeps the content surfaces free of other contexts", () => {
    const files = sourceFiles(LIB).filter((file) =>
      SURFACE_CONTEXTS.some((pattern) => pattern.test(relative(ROOT, file))),
    );

    // The rule is only worth anything while there are surfaces to apply it to.
    expect(files.length).toBeGreaterThan(0);

    const external = files.flatMap((file) => {
      const label = relative(ROOT, file);
      return importsOf(file)
        .filter((specifier) => !SURFACE_ALLOWED.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${label} imports ${specifier}`);
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
});
