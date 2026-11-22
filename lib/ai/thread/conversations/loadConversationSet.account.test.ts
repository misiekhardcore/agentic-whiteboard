import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

/**
 * The fake decodes each WHERE clause into predicates — an equality or an
 * `is null` — and applies them to the stored rows, so the loader's reads are
 * answered by the queries it actually writes. A joined read carries conditions
 * on both tables; a condition naming a column the row does not have is skipped,
 * because that column belongs to the other side of the join. Message rows are
 * answered unfiltered: the thread only keeps the ones under the selected
 * conversation's prompts.
 */
const dbState = vi.hoisted(() => ({
  conversations: [] as Record<string, unknown>[],
  prompts: [] as Record<string, unknown>[],
  messages: [] as Record<string, unknown>[],
}));

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

function predicates(condition: unknown): Predicate[] {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
  const found: Predicate[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const column = chunks[index] as { name?: unknown; table?: unknown; queryChunks?: unknown[] };

    // `and` nests each condition in its own SQL chunk; only the leaves hold the
    // column and its operator.
    if (column?.queryChunks) {
      found.push(...predicates(column));
      continue;
    }

    if (typeof column?.name !== "string" || !column.table) continue;

    const name = column.name;
    const operator = chunks[index + 1] as { value?: unknown };
    const text = Array.isArray(operator?.value) ? operator.value.join("") : "";

    if (text.includes("is null")) {
      found.push((row) => (name in row ? row[name] === null || row[name] === undefined : true));
      continue;
    }

    // The value is the parameter after the ` = ` text, not that text itself.
    const bound = chunks
      .slice(index + 1)
      .map((chunk) => chunk as { value?: unknown })
      .find((chunk) => chunk?.value !== undefined && !Array.isArray(chunk.value));

    if (bound) {
      found.push((row) => (name in row ? row[name] === bound.value : true));
    }
  }

  return found;
}

function ordered(table: unknown): Row[] {
  const rows = [...tableRows(table)];

  if (getTableName(table as never) === "agentConversation") {
    return rows.sort(
      (left, right) => (right.updatedAt as Date).getTime() - (left.updatedAt as Date).getTime(),
    );
  }

  return rows.sort(
    (left, right) => (left.createdAt as Date).getTime() - (right.createdAt as Date).getTime(),
  );
}

function tableRows(table: unknown): Row[] {
  switch (getTableName(table as never)) {
    case "agentConversation":
      return dbState.conversations;
    case "agentPrompt":
      return dbState.prompts;
    case "agentMessage":
      return dbState.messages;
    default:
      return [];
  }
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const matching = (condition: unknown) =>
          getTableName(table as never) === "agentMessage"
            ? ordered(table)
            : ordered(table).filter((row) =>
                predicates(condition).every((predicate) => predicate(row)),
              );

        return {
          where: (condition: unknown) => ({
            limit: (count: number) => Promise.resolve(matching(condition).slice(0, count)),
            orderBy: () => {
              const rows = matching(condition);
              return {
                limit: (count: number) => Promise.resolve(rows.slice(0, count)),
                then: (resolve: (value: Row[]) => unknown) => Promise.resolve(rows).then(resolve),
              };
            },
          }),
          innerJoin: () => ({
            where: (condition: unknown) => ({
              orderBy: () => Promise.resolve(matching(condition)),
            }),
          }),
        };
      },
    }),
  },
}));

import type { ConversationOwner } from "@/lib/ai/thread/rules";

import { loadConversationSet } from "./loadConversationSet";

const organization: ConversationOwner = { userId: "user_1", organizationId: "org_1" };

const personalConversation = {
  id: "conversation_personal",
  userId: "user_1",
  organizationId: null,
  title: "Personal",
  updatedAt: new Date("2026-11-21T10:00:00Z"),
};
const latestOrganizationConversation = {
  id: "conversation_latest",
  userId: "user_1",
  organizationId: "org_1",
  title: "Latest",
  updatedAt: new Date("2026-11-21T12:00:00Z"),
};
const olderOrganizationConversation = {
  id: "conversation_older",
  userId: "user_1",
  organizationId: "org_1",
  title: "Older",
  updatedAt: new Date("2026-11-21T11:00:00Z"),
};

const olderPrompt = {
  id: "prompt_1",
  conversationId: "conversation_older",
  workspaceId: null,
  supersededAt: null,
  status: "COMPLETED",
  createdAt: new Date("2026-11-21T11:01:00Z"),
};

const userMessage = {
  id: "message_user",
  promptId: "prompt_1",
  role: "USER",
  content: { parts: [{ type: "text", text: "Plan the schema" }] },
  supersededAt: null,
  createdAt: new Date("2026-11-21T11:01:00Z"),
};

const assistantMessage = {
  id: "message_assistant",
  promptId: "prompt_1",
  role: "ASSISTANT",
  content: { parts: [{ type: "text", text: "Here is the schema" }] },
  supersededAt: null,
  createdAt: new Date("2026-11-21T11:02:00Z"),
};

describe("loading the conversation set a composer mount shows", () => {
  it("returns the URL's conversation with its thread and the account's recent list", async () => {
    dbState.conversations = [
      personalConversation,
      olderOrganizationConversation,
      latestOrganizationConversation,
    ];
    dbState.prompts = [olderPrompt];
    dbState.messages = [assistantMessage, userMessage];

    await expect(
      loadConversationSet({
        owner: organization,
        requested: olderOrganizationConversation.id,
      }),
    ).resolves.toEqual({
      conversationId: olderOrganizationConversation.id,
      messages: [
        {
          id: userMessage.id,
          role: "user",
          parts: [{ type: "text", text: "Plan the schema" }],
        },
        {
          id: assistantMessage.id,
          role: "assistant",
          parts: [{ type: "text", text: "Here is the schema" }],
        },
      ],
      canRetry: false,
      conversations: [
        {
          id: latestOrganizationConversation.id,
          title: latestOrganizationConversation.title,
          updatedAt: latestOrganizationConversation.updatedAt,
        },
        {
          id: olderOrganizationConversation.id,
          title: olderOrganizationConversation.title,
          updatedAt: olderOrganizationConversation.updatedAt,
        },
      ],
    });
  });

  it("replaces a conversation from another account with this account's latest", async () => {
    dbState.conversations = [
      personalConversation,
      olderOrganizationConversation,
      latestOrganizationConversation,
    ];
    dbState.prompts = [];
    dbState.messages = [];

    const view = await loadConversationSet({
      owner: organization,
      requested: personalConversation.id,
    });

    expect(view.conversationId).toBe(latestOrganizationConversation.id);
    expect(view.conversations.map((conversation) => conversation.id)).toEqual([
      latestOrganizationConversation.id,
      olderOrganizationConversation.id,
    ]);
  });
});
