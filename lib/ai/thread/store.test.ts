import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store's two reads and two writes are mocked per chain so a test can say
 * "the thread has one active prompt" or "the insert hit the unique index"
 * without a database.
 */
const mocks = vi.hoisted(() => ({
  activeRows: [] as { id: string }[],
  retired: [] as unknown[],
  insertError: null as Error | null,
  created: [{ id: "prompt_new" }] as { id: string }[],
  sweeps: 0,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mocks.activeRows),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: () => {
          mocks.sweeps += 1;
          mocks.retired.push(values);
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          mocks.insertError ? Promise.reject(mocks.insertError) : Promise.resolve(mocks.created),
      }),
    }),
  },
}));

import { deadThreadPrompts, openDashboardPrompt } from "./store";

const open = () =>
  openDashboardPrompt({
    ownerId: "user_1",
    userId: "user_1",
    provider: "lmstudio",
    model: "qwen",
  });

/** What drizzle-orm 0.45 actually throws: the driver's error is the `cause`. */
function wrappedQueryError(code: string): Error {
  return Object.assign(new Error('Failed query: insert into "agentPrompt" ...'), {
    query: 'insert into "agentPrompt" ...',
    params: [],
    cause: Object.assign(new Error("duplicate key value violates unique constraint"), { code }),
  });
}

beforeEach(() => {
  mocks.activeRows = [];
  mocks.retired = [];
  mocks.insertError = null;
  mocks.created = [{ id: "prompt_new" }];
  mocks.sweeps = 0;
});

describe("which active prompts a send retires", () => {
  it("keeps the prompt this process is streaming", () => {
    expect(
      deadThreadPrompts([{ id: "prompt_live" }, { id: "prompt_dead" }], ["prompt_live"]),
    ).toEqual(["prompt_dead"]);
  });

  it("retires every active prompt when this process streams none", () => {
    expect(deadThreadPrompts([{ id: "prompt_a" }, { id: "prompt_b" }], [])).toEqual([
      "prompt_a",
      "prompt_b",
    ]);
  });

  it("has nothing to retire on a free thread", () => {
    expect(deadThreadPrompts([], ["prompt_live"])).toEqual([]);
  });
});

describe("opening a dashboard prompt", () => {
  it("opens the prompt on a free thread without a sweep", async () => {
    await expect(open()).resolves.toEqual({ kind: "opened", promptId: "prompt_new" });
    expect(mocks.sweeps).toBe(0);
  });

  it("retires a prompt no process is streaming before opening a new one", async () => {
    mocks.activeRows = [{ id: "prompt_orphaned" }];

    await expect(open()).resolves.toEqual({ kind: "opened", promptId: "prompt_new" });

    expect(mocks.sweeps).toBe(1);
    expect(mocks.retired[0]).toMatchObject({ status: "FAILED" });
  });

  it("reports busy when the insert hits the single-flight index through drizzle's wrapper", async () => {
    mocks.insertError = wrappedQueryError("23505");

    await expect(open()).resolves.toEqual({ kind: "busy" });
  });

  it("reports busy for a bare driver error too", async () => {
    mocks.insertError = Object.assign(new Error("duplicate key"), { code: "23505" });

    await expect(open()).resolves.toEqual({ kind: "busy" });
  });

  it("rethrows a failure that is not the single-flight rule", async () => {
    const failure = wrappedQueryError("23503");
    mocks.insertError = failure;

    await expect(open()).rejects.toBe(failure);
  });
});
