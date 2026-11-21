import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

/**
 * The fake applies the equality pairs of each WHERE clause to the stored
 * conversations, so the requested id and the "latest" fallback are answered by
 * the real queries rather than by queued rows.
 */
const dbState = vi.hoisted(() => ({ conversations: [] as Record<string, unknown>[] }));

type Equality = { column: string; value: unknown };

function equalities(condition: unknown): Equality[] {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
  const pairs: Equality[] = [];

  for (const chunk of chunks) {
    const nested = chunk as { queryChunks?: unknown[]; name?: unknown; table?: unknown };

    if (nested?.queryChunks) {
      pairs.push(...equalities(nested));
      continue;
    }

    if (typeof nested?.name !== "string" || !nested.table) continue;

    const next = chunks
      .slice(chunks.indexOf(chunk) + 1)
      .map((candidate) => candidate as { value?: unknown })
      .find((candidate) => candidate?.value !== undefined && !Array.isArray(candidate.value));

    if (next) pairs.push({ column: nested.name, value: next.value });
  }

  return pairs;
}

const matches = (condition: unknown, row: Record<string, unknown>) =>
  equalities(condition).every((pair) => row[pair.column] === pair.value);

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: (table: { [key: symbol]: unknown }) => ({
        where: (condition: unknown) => {
          const selected =
            getTableName(table as never) === "agentConversation"
              ? dbState.conversations.filter((row) => matches(condition, row))
              : [];

          return {
            limit: () => Promise.resolve(selected),
            orderBy: () => ({
              limit: () => Promise.resolve(selected),
            }),
          };
        },
      }),
    }),
  },
}));

import type { ConversationOwner } from "@/lib/ai/thread/rules";

import { resolveActiveConversation } from "./resolveActiveConversation";

const personal: ConversationOwner = {
  userId: "user_1",
  accountType: "PERSONAL",
  accountId: "user_1",
};
const organization: ConversationOwner = {
  userId: "user_1",
  accountType: "ORGANIZATION",
  accountId: "org_1",
};

const personalConversation = {
  id: "conversation_personal",
  userId: "user_1",
  accountType: "PERSONAL",
  accountId: "user_1",
  updatedAt: new Date("2026-11-21T10:00:00Z"),
};
const organizationConversation = {
  id: "conversation_organization",
  userId: "user_1",
  accountType: "ORGANIZATION",
  accountId: "org_1",
  updatedAt: new Date("2026-11-21T11:00:00Z"),
};

describe("resolving the open conversation", () => {
  it("opens the person's latest conversation in the active account", async () => {
    dbState.conversations = [personalConversation, organizationConversation];

    await expect(resolveActiveConversation({ owner: personal })).resolves.toBe(
      personalConversation.id,
    );
    await expect(resolveActiveConversation({ owner: organization })).resolves.toBe(
      organizationConversation.id,
    );
  });

  it("replaces an id belonging to the other account instead of opening it", async () => {
    dbState.conversations = [personalConversation, organizationConversation];

    await expect(
      resolveActiveConversation({ owner: personal, requested: organizationConversation.id }),
    ).resolves.toBe(personalConversation.id);
  });
});
