import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The title job's contract is one conditional write and one publication. The
 * database is a small fake that answers by table name, so a test can say "this
 * conversation already has a generated title", "the thread has no readable
 * text" or "another send won the row" without a real database.
 */
const mocks = vi.hoisted(() => ({
  conversation: null as { titleGeneratedAt: Date | null } | null,
  prompts: [{ id: "prompt_1", createdAt: new Date("2026-11-03T10:00:00Z"), status: "COMPLETED" }],
  messages: [] as { id: string; promptId: string; role: string; content: unknown }[],
  /** The rows the conditional update matched; empty when another send won. */
  written: [{ id: "conversation_1" }] as { id: string }[],
  requested: [] as string[],
  ops: [] as { table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");

  const rows = (value: unknown[]) => ({
    orderBy: () => rows(value),
    limit: () => Promise.resolve(value),
    then: (resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  });

  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);

          if (name === "agentConversation") {
            return {
              where: () => rows(mocks.conversation ? [mocks.conversation] : []),
            };
          }

          // The live-turns read asks the prompt table first, then its messages.
          return { where: () => rows(name === "agentPrompt" ? mocks.prompts : mocks.messages) };
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => {
          mocks.ops.push({ table: getTableName(table as never), values });
          return { where: () => ({ returning: () => Promise.resolve(mocks.written) }) };
        },
      }),
    },
  };
});

vi.mock("./requestConversationTitle", () => ({
  requestConversationTitle: vi.fn(({ source }: { source: string }) => {
    mocks.requested.push(source);
    return Promise.resolve("Quarterly roadmap");
  }),
}));

vi.mock("@/lib/capabilities/changes", () => ({ publishChanges: vi.fn(() => Promise.resolve()) }));

vi.mock("./config", () => ({ isTitleConfigured: () => true }));

import { publishChanges } from "@/lib/capabilities/changes";

import { refineConversationTitle } from "./refineConversationTitle";

let messageCount = 0;
const aPrompt = (text: string) => {
  messageCount += 1;

  return {
    id: `message_${messageCount}`,
    promptId: "prompt_1",
    role: "USER",
    content: { parts: [{ type: "text", text }] },
  };
};

beforeEach(() => {
  mocks.conversation = { titleGeneratedAt: null };
  mocks.messages = [aPrompt("Plan the schema for teams")];
  mocks.written = [{ id: "conversation_1" }];
  mocks.requested = [];
  mocks.ops = [];
  vi.mocked(publishChanges).mockClear();
});

describe("naming a conversation", () => {
  it("writes the generated title to the slot the derived one left open", async () => {
    await refineConversationTitle({ conversationId: "conversation_1", userId: "user_1" });

    expect(mocks.requested).toEqual(["Plan the schema for teams"]);
    expect(mocks.ops).toHaveLength(1);
    expect(mocks.ops[0].values).toMatchObject({ title: "Quarterly roadmap" });
    expect(mocks.ops[0].values.titleGeneratedAt).toBeInstanceOf(Date);
  });

  it("tells every open tab, because the switcher shows the label", async () => {
    await refineConversationTitle({ conversationId: "conversation_1", userId: "user_1" });

    expect(publishChanges).toHaveBeenCalledWith({
      changes: [{ key: "conversations", scope: "person" }],
      actor: { userId: "user_1", organizationId: null },
    });
  });

  it("names it only once", async () => {
    mocks.conversation = { titleGeneratedAt: new Date() };

    await refineConversationTitle({ conversationId: "conversation_1", userId: "user_1" });

    expect(mocks.requested).toEqual([]);
    expect(mocks.ops).toEqual([]);
  });

  it("spends no model call on a thread with no readable text", async () => {
    mocks.messages = [
      {
        id: "message_tool",
        promptId: "prompt_1",
        role: "USER",
        content: { parts: [{ type: "tool-call", toolName: "createWorkspace" }] },
      },
      aPrompt("  "),
    ];

    await refineConversationTitle({ conversationId: "conversation_1", userId: "user_1" });

    expect(mocks.requested).toEqual([]);
    expect(mocks.ops).toEqual([]);
  });

  it("leaves the derived title when another send already wrote one", async () => {
    mocks.written = [];

    await refineConversationTitle({ conversationId: "conversation_1", userId: "user_1" });

    expect(publishChanges).not.toHaveBeenCalled();
  });

  it("does nothing for a conversation that is not this person's", async () => {
    mocks.conversation = null;

    await refineConversationTitle({ conversationId: "conversation_other", userId: "user_1" });

    expect(mocks.requested).toEqual([]);
    expect(mocks.ops).toEqual([]);
  });
});
