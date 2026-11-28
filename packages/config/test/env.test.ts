import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadEnvironment } from "../env/load.mjs";

const directories: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "v2-env-"));
  directories.push(directory);

  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(directory, name), contents);
  }

  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("loadEnvironment", () => {
  it("reads .env and lets .env.local override it", async () => {
    const directory = await fixture({
      ".env": "DATABASE_URL=base\nSHARED=base\n",
      ".env.local": "SHARED=local\nLOCAL_ONLY=yes\n",
    });
    const env: Record<string, string | undefined> = {};

    loadEnvironment(directory, { env, nodeEnv: "development" });

    expect(env).toEqual({
      DATABASE_URL: "base",
      SHARED: "local",
      LOCAL_ONLY: "yes",
    });
  });

  it("layers .env, .env.<NODE_ENV>, .env.local and .env.<NODE_ENV>.local", async () => {
    const directory = await fixture({
      ".env": "VALUE=env\nONLY_ENV=env\n",
      ".env.production": "VALUE=production\nONLY_PRODUCTION=production\n",
      ".env.local": "VALUE=local\nONLY_LOCAL=local\n",
      ".env.production.local": "VALUE=production-local\n",
    });
    const env: Record<string, string | undefined> = {};

    loadEnvironment(directory, { env, nodeEnv: "production" });

    expect(env).toEqual({
      VALUE: "production-local",
      ONLY_ENV: "env",
      ONLY_PRODUCTION: "production",
      ONLY_LOCAL: "local",
    });
  });

  it("skips .env.local under test, as Next does", async () => {
    const directory = await fixture({
      ".env": "VALUE=env\n",
      ".env.local": "VALUE=local\n",
      ".env.test": "VALUE=test\n",
    });
    const env: Record<string, string | undefined> = {};

    loadEnvironment(directory, { env, nodeEnv: "test" });

    expect(env).toEqual({ VALUE: "test" });
  });

  it("keeps values the environment already exports", async () => {
    const directory = await fixture({ ".env": "VALUE=file\n", ".env.local": "VALUE=local\n" });
    const env: Record<string, string | undefined> = { VALUE: "shell" };

    loadEnvironment(directory, { env, nodeEnv: "development" });

    expect(env).toEqual({ VALUE: "shell" });
  });

  it("ignores files that do not exist", async () => {
    const directory = await fixture({});
    const env: Record<string, string | undefined> = {};

    expect(() => loadEnvironment(directory, { env, nodeEnv: "production" })).not.toThrow();
    expect(env).toEqual({});
  });
});
