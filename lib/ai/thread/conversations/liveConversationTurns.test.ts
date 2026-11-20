import { describe, expect, it, vi } from "vitest";

/**
 * The fake answers each select in order: the live prompts first, then their
 * messages. It records the conditions so "no prompts means no message read" is
 * asserted rather than inferred.
 */
const dbState = vi.hoisted(() => ({
  rows: [] as unknown[][],
  conditions: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          dbState.conditions.push(condition);
          const answer = dbState.rows.shift() ?? [];
          const rows = () => Promise.resolve(answer);
          return {
            orderBy: rows,
            then: (resolve: (value: unknown[]) => unknown) => rows().then(resolve),
          };
        },
      }),
    }),
  },
}));

import { liveConversationTurns } from "./liveConversationTurns";

const prompt = (id: string, createdAt: string, status = "COMPLETED") => ({
  id,
  createdAt: new Date(createdAt),
  status,
});

describe("liveConversationTurns", () => {
  it("has no turns, and reads no messages, for an empty conversation", async () => {
    dbState.rows.length = 0;
    dbState.conditions.length = 0;
    dbState.rows.push([]);

    await expect(
      liveConversationTurns({ userId: "user_1", conversationId: "conversation_1" }),
    ).resolves.toEqual([]);
    expect(dbState.conditions).toHaveLength(1);
  });

  it("nests each prompt's messages under it, oldest turn first", async () => {
    dbState.rows.length = 0;
    dbState.conditions.length = 0;
    dbState.rows.push(
      [prompt("prompt_1", "2026-11-03T10:00:00Z"), prompt("prompt_2", "2026-11-03T11:00:00Z")],
      [
        { id: "message_1", promptId: "prompt_1", role: "USER", content: { parts: [] } },
        { id: "message_2", promptId: "prompt_1", role: "ASSISTANT", content: { parts: [] } },
        { id: "message_3", promptId: "prompt_2", role: "USER", content: { parts: [] } },
      ],
    );

    const turns = await liveConversationTurns({
      userId: "user_1",
      conversationId: "conversation_1",
    });

    expect(turns.map((turn) => turn.promptId)).toEqual(["prompt_1", "prompt_2"]);
    expect(turns[0].messages.map((message) => message.id)).toEqual(["message_1", "message_2"]);
    expect(turns[1].messages.map((message) => message.id)).toEqual(["message_3"]);
    expect(turns[0]).toMatchObject({
      status: "COMPLETED",
      createdAt: new Date("2026-11-03T10:00:00Z"),
    });
    expect(dbState.conditions).toHaveLength(2);
  });

  it("gives a prompt with no messages a turn with none", async () => {
    dbState.rows.length = 0;
    dbState.conditions.length = 0;
    dbState.rows.push([prompt("prompt_1", "2026-11-03T10:00:00Z", "FAILED")], []);

    const [turn] = await liveConversationTurns({
      userId: "user_1",
      conversationId: "conversation_1",
    });

    expect(turn).toEqual({
      promptId: "prompt_1",
      createdAt: new Date("2026-11-03T10:00:00Z"),
      status: "FAILED",
      messages: [],
    });
  });
});
