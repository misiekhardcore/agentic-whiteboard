import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store's database work is exercised through a small fake: every chain the
 * store builds is answered by table name, and the writes it made are recorded.
 * A test can say "the thread has one active prompt", "the conversation is
 * somebody else's" or "this prompt failed", without a database.
 */
const mocks = vi.hoisted(() => ({
  activePrompts: [] as { id: string }[],
  livePrompts: [] as { id: string; createdAt: Date }[],
  conversationOwner: null as string | null,
  promptIds: [{ id: "prompt_new" }] as { id: string }[],
  insertError: null as Error | null,
  retryablePrompt: false,
  ops: [] as { op: string; table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");

  const rows = (value: unknown[]) => ({
    orderBy: () => rows(value),
    limit: () => Promise.resolve(value),
    then: (resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  });

  const conversationRows = () =>
    mocks.conversationOwner === null ? [] : [{ userId: mocks.conversationOwner }];

  type FakeDb = {
    transaction: <T>(work: (tx: FakeDb) => Promise<T>) => Promise<T>;
    select: () => unknown;
    insert: (table: unknown) => unknown;
    update: (table: unknown) => unknown;
  };

  const db: FakeDb = {
    transaction: <T>(work: (tx: FakeDb) => Promise<T>) => work(db),
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (getTableName(table as never) === "agentConversation") {
            return rows(conversationRows());
          }

          return {
            orderBy: () => rows(mocks.livePrompts),
            limit: () => Promise.resolve(mocks.retryablePrompt ? [{ id: "prompt_failed" }] : []),
            then: (resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
              Promise.resolve(mocks.activePrompts).then(resolve, reject),
          };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const name = getTableName(table as never);
        mocks.ops.push({ op: "insert", table: name, values });

        if (name === "agentConversation" && mocks.conversationOwner === null) {
          mocks.conversationOwner = String(values.userId);
        }

        return {
          onConflictDoNothing: () =>
            mocks.insertError ? Promise.reject(mocks.insertError) : Promise.resolve(),
          returning: () =>
            mocks.insertError
              ? Promise.reject(mocks.insertError)
              : Promise.resolve(mocks.promptIds),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          mocks.ops.push({ op: "update", table: getTableName(table as never), values });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db };
});

import { deadThreadPrompts, openDashboardPrompt, retryFailedPrompt } from "./store";

const open = (options: { discardFrom?: { id: string; createdAt: Date } } = {}) =>
  openDashboardPrompt({
    conversationId: "conversation_1",
    ownerId: "user_1",
    userId: "user_1",
    provider: "lmstudio",
    model: "qwen",
    ...options,
  });

/** What drizzle-orm 0.45 actually throws: the driver's error is the `cause`. */
function wrappedQueryError(code: string): Error {
  return Object.assign(new Error('Failed query: insert into "agentPrompt" ...'), {
    query: 'insert into "agentPrompt" ...',
    params: [],
    cause: Object.assign(new Error("duplicate key value violates unique constraint"), { code }),
  });
}

function updatesTo(table: string, key: string) {
  return mocks.ops.filter((op) => op.op === "update" && op.table === table && key in op.values);
}

beforeEach(() => {
  mocks.activePrompts = [];
  mocks.livePrompts = [];
  mocks.conversationOwner = null;
  mocks.promptIds = [{ id: "prompt_new" }];
  mocks.insertError = null;
  mocks.retryablePrompt = false;
  mocks.ops = [];
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
    mocks.conversationOwner = "user_1";

    await expect(open()).resolves.toEqual({ kind: "opened", promptId: "prompt_new" });
    expect(updatesTo("agentPrompt", "status")).toHaveLength(0);
  });

  it("records the prompt in its conversation and touches the conversation", async () => {
    mocks.conversationOwner = "user_1";

    await open();

    const prompt = mocks.ops.find((op) => op.op === "insert" && op.table === "agentPrompt");
    expect(prompt?.values).toMatchObject({ conversationId: "conversation_1", ownerId: "user_1" });
    expect(updatesTo("agentConversation", "updatedAt")).toHaveLength(1);
  });

  it("creates the conversation with its first prompt", async () => {
    await expect(open()).resolves.toEqual({ kind: "opened", promptId: "prompt_new" });

    const conversation = mocks.ops.find(
      (op) => op.op === "insert" && op.table === "agentConversation",
    );
    expect(conversation?.values).toMatchObject({ id: "conversation_1", userId: "user_1" });
  });

  it("refuses to write into a conversation that belongs to somebody else", async () => {
    mocks.conversationOwner = "user_other";

    await expect(open()).resolves.toEqual({ kind: "missing" });
    expect(mocks.ops.some((op) => op.op === "insert" && op.table === "agentPrompt")).toBe(false);
  });

  it("retires a prompt no process is streaming before opening a new one", async () => {
    mocks.activePrompts = [{ id: "prompt_orphaned" }];

    await expect(open()).resolves.toEqual({ kind: "opened", promptId: "prompt_new" });

    expect(updatesTo("agentPrompt", "status")[0]?.values).toMatchObject({ status: "FAILED" });
  });

  it("supersedes the branch turn instead of deleting it", async () => {
    mocks.conversationOwner = "user_1";
    mocks.livePrompts = [
      { id: "prompt_1", createdAt: new Date("2026-11-16T10:00:00Z") },
      { id: "prompt_2", createdAt: new Date("2026-11-16T10:01:00Z") },
    ];

    await expect(
      open({ discardFrom: { id: "prompt_1", createdAt: new Date("2026-11-16T10:00:00Z") } }),
    ).resolves.toEqual({ kind: "opened", promptId: "prompt_new" });

    const superseded = updatesTo("agentPrompt", "supersededAt");
    expect(superseded).toHaveLength(1);
    // The prompt is inserted before the old turns are marked, so the new turn
    // is never part of its own discard set.
    const insertAt = mocks.ops.findIndex((op) => op.op === "insert" && op.table === "agentPrompt");
    const supersedeAt = mocks.ops.findIndex(
      (op) => op.op === "update" && op.table === "agentPrompt" && "supersededAt" in op.values,
    );
    expect(insertAt).toBeGreaterThanOrEqual(0);
    expect(supersedeAt).toBeGreaterThan(insertAt);
  });

  it("reports busy when the insert hits the single-flight index through drizzle's wrapper", async () => {
    mocks.conversationOwner = "user_1";
    mocks.insertError = wrappedQueryError("23505");

    await expect(open()).resolves.toEqual({ kind: "busy" });
  });

  it("reports busy for a bare driver error too", async () => {
    mocks.conversationOwner = "user_1";
    mocks.insertError = Object.assign(new Error("duplicate key"), { code: "23505" });

    await expect(open()).resolves.toEqual({ kind: "busy" });
  });

  it("rethrows a failure that is not the single-flight rule", async () => {
    mocks.conversationOwner = "user_1";
    const failure = wrappedQueryError("23503");
    mocks.insertError = failure;

    await expect(open()).rejects.toBe(failure);
  });
});

describe("retrying a prompt that failed", () => {
  it("reuses the row and hides the failed replies instead of opening a new prompt", async () => {
    mocks.retryablePrompt = true;

    await expect(
      retryFailedPrompt({
        conversationId: "conversation_1",
        promptId: "prompt_failed",
        userId: "user_1",
      }),
    ).resolves.toBe(true);

    expect(mocks.ops.some((op) => op.op === "insert")).toBe(false);

    const replies = updatesTo("agentMessage", "supersededAt");
    expect(replies).toHaveLength(1);
    expect(replies[0]?.values.supersededAt).toBeInstanceOf(Date);

    expect(updatesTo("agentPrompt", "status")[0]?.values).toMatchObject({
      status: "RUNNING",
      error: null,
      finishedAt: null,
    });
  });

  it("refuses a prompt that is not a failed one in this conversation", async () => {
    mocks.retryablePrompt = false;

    await expect(
      retryFailedPrompt({
        conversationId: "conversation_1",
        promptId: "prompt_failed",
        userId: "user_1",
      }),
    ).resolves.toBe(false);
    expect(mocks.ops).toHaveLength(0);
  });
});
