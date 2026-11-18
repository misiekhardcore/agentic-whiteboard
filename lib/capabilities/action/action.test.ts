import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { Capability } from "../define";

import { action } from "./action";

const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);

const identity = vi.hoisted(() => ({
  humanContext: () =>
    Promise.resolve({
      actorType: "human" as const,
      actor: { userId: "user_1", organizationId: null, accountName: "Personal" },
    }),
}));
vi.mock("./humanContext", () => identity);

const refusal = { ok: false as const, error: "That workspace is gone." };

function capability(overrides: {
  handler?: () => Promise<unknown>;
  changes?: () => { key: string; scope: "person" | "account" }[];
}) {
  return {
    name: "example",
    description: "does something",
    input: z.object({}),
    output: z.union([
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), error: z.string() }),
    ]),
    callers: ["human"],
    handler: overrides.handler ?? (() => Promise.resolve({ ok: true as const })),
    ...(overrides.changes ? { changes: overrides.changes } : {}),
  } as unknown as Capability<unknown, unknown, undefined>;
}

beforeEach(() => {
  cache.refresh.mockClear();
});

describe("the human entry point", () => {
  it("refreshes the route the caller is on when the call changed datasets", async () => {
    const call = action(capability({ changes: () => [] }));

    await expect(call({})).resolves.toEqual({ ok: true });
    expect(cache.refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes nothing for a capability that declares no change", async () => {
    const call = action(capability({}));

    await expect(call({})).resolves.toEqual({ ok: true });
    expect(cache.refresh).not.toHaveBeenCalled();
  });

  it("refreshes nothing for a refusal", async () => {
    const call = action(capability({ handler: () => Promise.resolve(refusal), changes: () => [] }));

    await expect(call({})).resolves.toEqual(refusal);
    expect(cache.refresh).not.toHaveBeenCalled();
  });
});
