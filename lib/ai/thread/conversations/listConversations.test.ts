import { describe, expect, it, vi } from "vitest";

/**
 * The dashboard label is two facts with one precedence: a generated title when
 * one exists, and the first live prompt until then. The read is exercised
 * through a fake that answers each query by table, so the assertion is about the
 * label a person actually sees.
 */
const mocks = vi.hoisted(() => ({
  conversations: [] as { id: string; title: string | null; updatedAt: Date }[],
  messages: [] as { conversationId: string; content: unknown }[],
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
          const where = () => {
            if (name === "agentConversation") return rows(mocks.conversations);
            return rows(mocks.messages);
          };

          return { where, innerJoin: () => ({ where }) };
        },
      }),
    },
  };
});

import { listConversations } from "./listConversations";

const updatedAt = new Date("2026-11-17T10:00:00Z");

describe("listConversations", () => {
  it("shows a generated title instead of the prompt it came from", async () => {
    mocks.conversations = [{ id: "conversation_1", title: "Schema planning", updatedAt }];
    mocks.messages = [
      {
        conversationId: "conversation_1",
        content: { parts: [{ type: "text", text: "Plan the schema" }] },
      },
    ];

    const [conversation] = await listConversations("user_1", 5);

    expect(conversation).toEqual({
      id: "conversation_1",
      title: "Schema planning",
      preview: "Plan the schema",
      updatedAt,
    });
  });

  it("falls back to the first live prompt while a title is still missing", async () => {
    mocks.conversations = [{ id: "conversation_2", title: null, updatedAt }];
    mocks.messages = [
      {
        conversationId: "conversation_2",
        content: { parts: [{ type: "text", text: "Plan the schema" }] },
      },
      {
        conversationId: "conversation_2",
        content: { parts: [{ type: "text", text: "Now the API" }] },
      },
    ];

    const [conversation] = await listConversations("user_1", 5);

    expect(conversation).toMatchObject({ title: null, preview: "Plan the schema" });
  });

  it("has nothing to list for a person with no conversations", async () => {
    mocks.conversations = [];
    mocks.messages = [];

    expect(await listConversations("user_1", 5)).toEqual([]);
  });
});
