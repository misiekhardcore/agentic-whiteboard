import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The prompt row's database work is exercised through a small fake: every chain
 * the module builds is answered by table name, and the writes it made are
 * recorded. A test can say "the thread has one active prompt", "the conversation
 * is somebody else's" or "this prompt failed", without a database.
 */
const mocks = vi.hoisted(() => ({
  activePrompts: [] as { id: string }[],
  livePrompts: [] as { id: string; createdAt: Date }[],
  conversationOwner: null as string | null,
  conversationOrganizationId: null as string | null,
  promptIds: [{ id: "prompt_new" }] as { id: string }[],
  insertError: null as Error | null,
  /** The rows a compare-and-swap returns; empty when another send won the row. */
  retryRows: [{ id: "prompt_failed" }] as { id: string }[],
  retryError: null as Error | null,
  /** A write that is not the retry's compare-and-swap failing. */
  updateError: null as Error | null,
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

  // The suite always acts as user_1 in their personal account, so the fake can
  // answer the account-scoped read the way the database would: a row owned by
  // somebody else, or filed under another account, comes back empty.
  const conversationRows = () =>
    mocks.conversationOwner === "user_1" && mocks.conversationOrganizationId === null
      ? [{ id: "conversation_1" }]
      : [];

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
            limit: () => Promise.resolve([]),
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

        // Whether this insert was the one that created the conversation.
        const createdConversation =
          name === "agentConversation" && mocks.conversationOwner === null;
        if (name === "agentConversation" && mocks.conversationOwner === null) {
          mocks.conversationOwner = String(values.userId);
          mocks.conversationOrganizationId = (values.organizationId as string | null) ?? null;
        }

        const rowsAfterConflict = () => {
          if (mocks.insertError) return Promise.reject(mocks.insertError);
          return Promise.resolve(
            name === "agentConversation"
              ? createdConversation
                ? [{ id: String(values.id) }]
                : []
              : mocks.promptIds,
          );
        };

        return {
          onConflictDoNothing: () => ({
            returning: rowsAfterConflict,
            then: (resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
              (mocks.insertError
                ? Promise.reject(mocks.insertError)
                : Promise.resolve([] as unknown[])
              ).then(resolve, reject),
          }),
          returning: rowsAfterConflict,
        };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          const name = getTableName(table as never);
          mocks.ops.push({ op: "update", table: name, values });

          return {
            // Only the retry's compare-and-swap asks for the row back.
            returning: () =>
              mocks.retryError
                ? Promise.reject(mocks.retryError)
                : Promise.resolve(mocks.retryRows),
            then: (resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
              (mocks.updateError
                ? Promise.reject(mocks.updateError)
                : Promise.resolve([] as unknown[])
              ).then(resolve, reject),
          };
        },
      }),
    }),
  };

  return { db };
});

import { openDashboardPrompt, resumePrompt, retryFailedPrompt } from "./prompts";

const personalOwner = { userId: "user_1", organizationId: null } as const;

const open = (options: { discardFrom?: { id: string; createdAt: Date } } = {}) =>
  openDashboardPrompt({
    conversationId: "conversation_1",
    owner: personalOwner,
    provider: "lmstudio",
    model: "qwen",
    title: "Plan the schema",
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
  mocks.conversationOrganizationId = null;
  mocks.promptIds = [{ id: "prompt_new" }];
  mocks.insertError = null;
  mocks.retryRows = [{ id: "prompt_failed" }];
  mocks.retryError = null;
  mocks.updateError = null;
  mocks.ops = [];
});

describe("opening a dashboard prompt", () => {
  it("opens the prompt on a free thread without a sweep", async () => {
    mocks.conversationOwner = "user_1";

    await expect(open()).resolves.toEqual({
      kind: "opened",
      promptId: "prompt_new",
      conversationCreated: false,
    });
    expect(updatesTo("agentPrompt", "status")).toHaveLength(0);
  });

  it("records the prompt in its conversation and touches the conversation", async () => {
    mocks.conversationOwner = "user_1";

    await open();

    const prompt = mocks.ops.find((op) => op.op === "insert" && op.table === "agentPrompt");
    expect(prompt?.values).toMatchObject({
      conversationId: "conversation_1",
      organizationId: null,
    });
    expect(updatesTo("agentConversation", "updatedAt")).toHaveLength(1);
  });

  it("creates the conversation with its first prompt", async () => {
    await expect(open()).resolves.toEqual({
      kind: "opened",
      promptId: "prompt_new",
      conversationCreated: true,
    });

    const conversation = mocks.ops.find(
      (op) => op.op === "insert" && op.table === "agentConversation",
    );
    expect(conversation?.values).toMatchObject({
      id: "conversation_1",
      userId: "user_1",
      organizationId: null,
      title: "Plan the schema",
    });
  });

  it("refuses to write into a conversation that belongs to somebody else", async () => {
    mocks.conversationOwner = "user_other";

    await expect(open()).resolves.toEqual({ kind: "missing" });
    expect(mocks.ops.some((op) => op.op === "insert" && op.table === "agentPrompt")).toBe(false);
  });

  it("refuses to write the personal account into an organization's conversation", async () => {
    mocks.conversationOwner = "user_1";
    mocks.conversationOrganizationId = "org_1";

    await expect(open()).resolves.toEqual({ kind: "missing" });
    expect(mocks.ops.some((op) => op.op === "insert" && op.table === "agentPrompt")).toBe(false);
  });

  it("retires a prompt no process is streaming before opening a new one", async () => {
    mocks.activePrompts = [{ id: "prompt_orphaned" }];

    await expect(open()).resolves.toEqual({
      kind: "opened",
      promptId: "prompt_new",
      conversationCreated: true,
    });

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
    ).resolves.toEqual({
      kind: "opened",
      promptId: "prompt_new",
      conversationCreated: false,
    });

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
  beforeEach(() => {
    mocks.conversationOwner = "user_1";
  });

  const retry = () =>
    retryFailedPrompt({
      conversationId: "conversation_1",
      promptId: "prompt_failed",
      owner: personalOwner,
    });

  it("reuses the row and hides the failed replies instead of opening a new prompt", async () => {
    await expect(retry()).resolves.toBe("resumed");

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

  it("refuses a prompt that is no longer the one that failed", async () => {
    // Another retry, or a send that replaced the turn, got there first.
    mocks.retryRows = [];

    await expect(retry()).resolves.toBe("expired");
    expect(updatesTo("agentMessage", "supersededAt")).toHaveLength(0);
    expect(updatesTo("agentConversation", "updatedAt")).toHaveLength(0);
  });

  it("reports busy when another prompt holds the single-flight index", async () => {
    mocks.retryError = wrappedQueryError("23505");

    await expect(retry()).resolves.toBe("busy");
    // The failed turn is left exactly as it was: no reply was hidden and the
    // prompt is still the one that failed.
    expect(updatesTo("agentMessage", "supersededAt")).toHaveLength(0);
    expect(updatesTo("agentConversation", "updatedAt")).toHaveLength(0);
  });

  it("reports busy for a bare driver error too", async () => {
    mocks.retryError = Object.assign(new Error("duplicate key"), { code: "23505" });

    await expect(retry()).resolves.toBe("busy");
  });

  it("rethrows a failure that is not the single-flight rule", async () => {
    const failure = wrappedQueryError("23503");
    mocks.retryError = failure;

    await expect(retry()).rejects.toBe(failure);
  });

  it("retires a prompt no process is streaming before reusing the row", async () => {
    mocks.activePrompts = [{ id: "prompt_orphaned" }];

    await expect(retry()).resolves.toBe("resumed");

    expect(updatesTo("agentPrompt", "status")[0]?.values).toMatchObject({ status: "FAILED" });
  });
});

describe("resuming a parked prompt", () => {
  it("puts it back into RUNNING", async () => {
    await expect(resumePrompt("prompt_parked")).resolves.toBe("resumed");

    expect(updatesTo("agentPrompt", "status")[0]?.values).toMatchObject({ status: "RUNNING" });
  });

  it("reports busy when a later send took the single-flight slot", async () => {
    mocks.updateError = wrappedQueryError("23505");

    await expect(resumePrompt("prompt_parked")).resolves.toBe("busy");
  });

  it("rethrows a failure that is not the single-flight rule", async () => {
    const failure = wrappedQueryError("23503");
    mocks.updateError = failure;

    await expect(resumePrompt("prompt_parked")).rejects.toBe(failure);
  });
});
