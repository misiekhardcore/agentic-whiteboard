import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Branching is mostly SQL, so it is exercised through a small fake: the three
 * reads it makes are answered by table, and every write is recorded. A test can
 * then say "this reply is the second of three turns" or "this turn is still
 * running" without a database.
 */
type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  /** The joined read that resolves the reply to its prompt. */
  turn: [] as Row[],
  /** The conversation's live prompts, oldest first. */
  prompts: [] as Row[],
  /** The conversation's live messages, oldest first. */
  messages: [] as Row[],
  ops: [] as { table: string; values: Row }[],
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");

  type Chain = {
    innerJoin: () => Chain;
    where: () => Chain;
    orderBy: () => Chain;
    limit: () => Promise<Row[]>;
    then: (
      resolve: (rows: Row[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) => Promise<unknown>;
  };

  const rowsFor = (table: string, joined: boolean): Row[] => {
    if (table === "agentPrompt") return mocks.prompts;
    return joined ? mocks.turn : mocks.messages;
  };

  const chainFor = (table: string): Chain => {
    let joined = false;
    const resolved = () => Promise.resolve(rowsFor(table, joined));

    const chain: Chain = {
      innerJoin: () => {
        joined = true;
        return chain;
      },
      where: () => chain,
      orderBy: () => chain,
      limit: resolved,
      then: (resolve, reject) => resolved().then(resolve, reject),
    };

    return chain;
  };

  type FakeDb = {
    transaction: <T>(work: (tx: FakeDb) => Promise<T>) => Promise<T>;
    select: () => { from: (table: unknown) => Chain };
    insert: (table: unknown) => {
      values: (values: Row) => {
        returning: () => Promise<Row[]>;
        then: (
          resolve: (rows: Row[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) => Promise<unknown>;
      };
    };
  };

  // The real schema fills a missing `id` from cuid2 before the row is sent; the
  // fake stands in for that so a test can tell the copies apart.
  let copies = 0;

  const db: FakeDb = {
    transaction: (work) => work(db),
    select: () => ({
      from: (table) => chainFor(getTableName(table as never)),
    }),
    insert: (table) => ({
      values: (values) => {
        const name = getTableName(table as never);
        if (name === "agentPrompt") copies += 1;
        if (values.id === undefined) values.id = `prompt_copy_${copies}`;

        mocks.ops.push({ table: name, values });

        return {
          returning: () => Promise.resolve([{ id: values.id }]),
          then: (resolve, reject) => Promise.resolve([] as Row[]).then(resolve, reject),
        };
      },
    }),
  };

  return { db };
});

import { branchConversation } from "./branches";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 16, 12, minute));

/** Three turns, each with the person's message and the agent's reply. */
function threeTurns() {
  const prompts = [1, 2, 3].map((minute) => ({
    id: `prompt_${minute}`,
    createdAt: at(minute),
    ownerId: "user_1",
    provider: "lmstudio",
    model: "qwen",
  }));

  const messages = [1, 2, 3].flatMap((minute) => [
    {
      promptId: `prompt_${minute}`,
      role: "USER",
      actorType: "USER",
      userId: "user_1",
      content: { parts: [{ type: "text", text: `Question ${minute}` }] },
    },
    {
      promptId: `prompt_${minute}`,
      role: "ASSISTANT",
      actorType: "AGENT",
      userId: null,
      content: { parts: [{ type: "text", text: `Answer ${minute}` }] },
    },
  ]);

  return { prompts, messages };
}

const branch = (messageId = "message_2") =>
  branchConversation({
    owner: { userId: "user_1", accountType: "PERSONAL", accountId: "user_1" },
    conversationId: "conversation_1",
    messageId,
  });

const inserts = (table: string) => mocks.ops.filter((op) => op.table === table);

beforeEach(() => {
  mocks.turn = [];
  mocks.prompts = [];
  mocks.messages = [];
  mocks.ops = [];
});

describe("branching a conversation", () => {
  it("copies the turns through the reply into a new conversation", async () => {
    const { prompts, messages } = threeTurns();
    mocks.prompts = prompts;
    mocks.messages = messages;
    mocks.turn = [{ id: "prompt_2", createdAt: at(2), status: "COMPLETED" }];

    const result = await branch();

    expect(result.kind).toBe("branched");
    if (result.kind !== "branched") return;

    const [conversation] = inserts("agentConversation");
    expect(conversation?.values).toMatchObject({ id: result.conversationId, userId: "user_1" });

    const copies = inserts("agentPrompt");
    expect(copies).toHaveLength(2);
    expect(copies.map((copy) => copy.values.branchedFromId)).toEqual(["prompt_1", "prompt_2"]);
    for (const copy of copies) {
      expect(copy.values).toMatchObject({
        conversationId: result.conversationId,
        userId: "user_1",
        ownerId: "user_1",
        // History: a copy never holds the single-flight slot and never looks
        // like work the person still owes a retry on.
        status: "COMPLETED",
        provider: "lmstudio",
      });
    }
  });

  it("leaves the turns after the reply behind", async () => {
    const { prompts, messages } = threeTurns();
    mocks.prompts = prompts;
    mocks.messages = messages;
    mocks.turn = [{ id: "prompt_2", createdAt: at(2), status: "COMPLETED" }];

    await branch();

    const texts = inserts("agentMessage").flatMap((op) =>
      ((op.values.content as { parts: { text: string }[] }).parts ?? []).map((part) => part.text),
    );

    expect(texts).toEqual(["Question 1", "Answer 1", "Question 2", "Answer 2"]);
  });

  it("attaches each copied message to the copied turn, in the source order", async () => {
    const { prompts, messages } = threeTurns();
    mocks.prompts = prompts;
    mocks.messages = messages;
    mocks.turn = [{ id: "prompt_3", createdAt: at(3), status: "COMPLETED" }];

    await branch("message_3");

    const copies = inserts("agentPrompt").map((op) => op.values.id);
    const copiedMessages = inserts("agentMessage");
    expect(copiedMessages).toHaveLength(6);
    expect(copiedMessages.slice(0, 2).map((op) => op.values.promptId)).toEqual([
      copies[0],
      copies[0],
    ]);
    expect(copiedMessages.at(-1)?.values.promptId).toBe(copies.at(-1));

    // The copy reads as one continuous past thread: every row lands a moment
    // after the one before it, in the order it was written.
    const moments = mocks.ops
      .filter((op) => op.table !== "agentConversation")
      .map((op) => (op.values.createdAt as Date).getTime());
    expect([...moments].sort((a, b) => a - b)).toEqual(moments);
    expect(new Set(moments).size).toBe(moments.length);
  });

  it("keeps the actor on each copied message", async () => {
    const { prompts, messages } = threeTurns();
    mocks.prompts = prompts;
    mocks.messages = messages;
    mocks.turn = [{ id: "prompt_1", createdAt: at(1), status: "COMPLETED" }];

    await branch("message_1");

    const [question, answer] = inserts("agentMessage");
    expect(question?.values).toMatchObject({
      role: "USER",
      actorType: "USER",
      userId: "user_1",
      workspaceId: null,
    });
    expect(answer?.values).toMatchObject({ role: "ASSISTANT", actorType: "AGENT", userId: null });
  });

  it("refuses a reply that is not a live turn of this conversation", async () => {
    mocks.turn = [];

    await expect(branch()).resolves.toEqual({ kind: "missing" });
    expect(mocks.ops).toEqual([]);
  });

  it("refuses a turn that has not finished", async () => {
    const { prompts, messages } = threeTurns();
    mocks.prompts = prompts;
    mocks.messages = messages;
    mocks.turn = [{ id: "prompt_2", createdAt: at(2), status: "RUNNING" }];

    await expect(branch()).resolves.toEqual({ kind: "unfinished" });
    expect(mocks.ops).toEqual([]);
  });

  it("refuses a branch whose turn is no longer among the live prompts", async () => {
    mocks.prompts = [];
    mocks.turn = [{ id: "prompt_older", createdAt: at(0), status: "COMPLETED" }];

    await expect(branch()).resolves.toEqual({ kind: "missing" });
    expect(mocks.ops).toEqual([]);
  });
});
