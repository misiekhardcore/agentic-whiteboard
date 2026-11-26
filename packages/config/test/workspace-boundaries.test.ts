import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

type Manifest = {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type WorkspacePackage = {
  name: string;
  directory: string;
  manifest: Manifest;
};

const DB_CLIENTS = [
  "pg",
  "pg-native",
  "postgres",
  "drizzle-orm",
  "drizzle-kit",
  "@electric-sql/pglite",
  "mysql2",
  "better-sqlite3",
];

const FRAMEWORKS = ["next", "react", "react-dom", "@v2/db", "@v2/web", "@v2/agent"];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const SQL_STATEMENT = /\b(create|alter|drop)\s+(table|schema|index|extension|sequence|view)\b/i;
const IMPORT_SPECIFIER =
  /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function loadPackage(directory: string): Promise<WorkspacePackage> {
  const manifest = JSON.parse(await readText(join(directory, "package.json"))) as Manifest;
  return { name: manifest.name, directory, manifest };
}

async function loadPackages(): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];

  for (const group of ["packages", "apps"]) {
    const entries = await readdir(join(repoRoot, group), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      packages.push(await loadPackage(join(repoRoot, group, entry.name)));
    }
  }

  return packages;
}

const GENERATED_DIRECTORIES = new Set(["node_modules", ".next", "dist", "coverage"]);

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (GENERATED_DIRECTORIES.has(entry.name)) continue;
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

function importsIn(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

function matchesPackage(specifier: string, names: string[]): boolean {
  return names.some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

describe("the workspace skeleton", () => {
  it("makes every package extend the shared TypeScript base", async () => {
    const packages = await loadPackages();

    for (const pkg of packages) {
      if (pkg.name === "@v2/config") continue;
      const tsconfig = JSON.parse(await readText(join(pkg.directory, "tsconfig.json"))) as {
        extends?: string;
      };

      expect(tsconfig.extends, `${pkg.name} tsconfig`).toMatch(
        /^(?:@v2\/config\/tsconfig\.base\.json|\.\.\/\.\.\/packages\/config\/tsconfig\.base\.json)$/,
      );
    }
  });

  it("makes every package use the shared ESLint and Vitest presets", async () => {
    const packages = await loadPackages();

    for (const pkg of packages) {
      if (pkg.name === "@v2/config") continue;
      const eslintConfig = await readText(join(pkg.directory, "eslint.config.mjs"));
      const vitestConfig = await readText(join(pkg.directory, "vitest.config.mts"));

      expect(eslintConfig, `${pkg.name} eslint config`).toContain("@v2/config/eslint");
      expect(vitestConfig, `${pkg.name} vitest config`).toContain("@v2/config/vitest");
    }
  });

  it("keeps frameworks, databases and apps out of the capability kernel", async () => {
    const kernel = (await loadPackages()).find((pkg) => pkg.name === "@v2/capabilities");
    if (kernel === undefined) throw new Error("The capability kernel package is missing");

    for (const file of await listFiles(join(kernel.directory, "src"))) {
      if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) continue;
      const source = await readText(file);

      for (const specifier of importsIn(source)) {
        expect(
          matchesPackage(specifier, FRAMEWORKS),
          `${relative(repoRoot, file)} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  it("allows a database client in the database package only", async () => {
    const packages = await loadPackages();

    for (const pkg of packages) {
      const declared = [
        ...Object.keys(pkg.manifest.dependencies ?? {}),
        ...Object.keys(pkg.manifest.devDependencies ?? {}),
      ];
      const offending = declared.filter((name) => matchesPackage(name, DB_CLIENTS));

      if (pkg.name === "@v2/db") continue;

      expect(offending, `${pkg.name} declares a database client`).toEqual([]);

      for (const file of await listFiles(pkg.directory)) {
        if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) continue;
        if (file.includes("node_modules")) continue;
        const source = await readText(file);

        for (const specifier of importsIn(source)) {
          expect(
            matchesPackage(specifier, DB_CLIENTS),
            `${relative(repoRoot, file)} imports ${specifier}`,
          ).toBe(false);
        }
      }
    }
  });

  it("keeps DDL and SQL inside the database package", async () => {
    const database = (await loadPackages()).find((pkg) => pkg.name === "@v2/db");
    if (database === undefined) throw new Error("The database package is missing");

    for (const pkg of await loadPackages()) {
      if (pkg.name === database.name) continue;

      for (const file of await listFiles(pkg.directory)) {
        if (file.includes("node_modules")) continue;
        if (file.endsWith(".sql")) {
          throw new Error(`${relative(repoRoot, file)} contains SQL outside the database package`);
        }
        if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) continue;

        const source = await readText(file);
        expect(SQL_STATEMENT.test(source), `${relative(repoRoot, file)} contains DDL`).toBe(false);
      }
    }
  });

  it("keeps the contracts package free of runtime dependencies", async () => {
    const contracts = (await loadPackages()).find((pkg) => pkg.name === "@v2/contracts");
    if (contracts === undefined) throw new Error("The contracts package is missing");

    expect(Object.keys(contracts.manifest.dependencies ?? {})).toEqual([]);
  });
});
