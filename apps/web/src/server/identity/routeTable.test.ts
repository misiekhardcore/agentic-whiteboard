import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The one authorization gate, asserted instead of remembered. A route handler
 * that reads data without `requireActor()` is how a second, weaker auth path
 * appears; this walks the real route table so adding one fails here.
 */
const APP = join(import.meta.dirname, "../../../app");
const API = join(APP, "api");

/**
 * Routes that authenticate themselves and therefore do not take an actor from
 * a session. Keep this list explicit: a new entry is a review decision, not a
 * convenience.
 */
const SELF_AUTHENTICATED = [
  // better-auth's own endpoints: sign-in, sign-up, reset, invite acceptance,
  // OAuth callbacks and sign-out. They run before a session exists.
  "api/auth/[...all]/route.ts",
];

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return entry === "route.ts" ? [path] : [];
  });
}

describe("the route table", () => {
  it("resolves every route handler's actor through requireActor", () => {
    const offenders = routeFiles(API)
      .map((file) => relative(APP, file))
      .filter((file) => !SELF_AUTHENTICATED.includes(file))
      .filter((file) => !readFileSync(join(APP, file), "utf8").includes("requireActor"));

    expect(offenders).toEqual([]);
  });
});
