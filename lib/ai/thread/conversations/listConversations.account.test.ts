import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

/**
 * A tiny in-memory conversation table. The fake applies the equality pairs of
 * the query's own WHERE clause to the stored rows, so the test reads whichever
 * rows the real predicate selects rather than whichever rows it queued. The
 * first-message read is answered empty: the rows carry titles, which is all the
 * switcher needs, and the test is about which conversations are listed.
 */
const dbState = vi.hoisted(() => ({ conversations: [] as Record<string, unknown>[] }));

type Equality = { column: string; value: unknown };

function equalities(condition: unknown): Equality[] {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
  const pairs: Equality[] = [];

  for (let index = 0; index < chunks.length - 1; index += 1) {
    const column = chunks[index] as { name?: unknown; table?: unknown; queryChunks?: unknown[] };

    // `and` nests each condition in its own SQL chunk; only the leaves hold the
    // column and its value.
    if (column?.queryChunks) {
      pairs.push(...equalities(column));
      continue;
    }

    if (typeof column?.name !== "string" || !column.table) continue;

    // The value is the parameter after the ` = ` text, not that text itself.
    const bound = chunks
      .slice(index + 1)
      .map((chunk) => chunk as { value?: unknown })
      .find((chunk) => chunk?.value !== undefined && !Array.isArray(chunk.value));

    if (bound) pairs.push({ column: column.name, value: bound.value });
  }

  return pairs;
}

function matchingRows(condition: unknown): Record<string, unknown>[] {
  const pairs = equalities(condition);
  return dbState.conversations.filter((row) =>
    pairs.every((pair) => row[pair.column] === pair.value),
  );
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: (table: { [key: symbol]: unknown }) => {
        const isConversations = getTableName(table as never) === "agentConversation";

        const where = (condition: unknown) => ({
          orderBy: () => {
            const rows = isConversations ? matchingRows(condition) : [];
            return {
              limit: () => Promise.resolve(rows),
              then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
            };
          },
        });

        return {
          where,
          innerJoin: () => ({ where }),
        };
      },
    }),
  },
}));

import type { ConversationOwner } from "@/lib/ai/thread/rules";

import { listConversations } from "./listConversations";

const personalOwner: ConversationOwner = {
  userId: "user_1",
  accountType: "PERSONAL",
  accountId: "user_1",
};
const organizationOwner: ConversationOwner = {
  userId: "user_1",
  accountType: "ORGANIZATION",
  accountId: "org_1",
};

function conversation(id: string, owner: ConversationOwner) {
  return {
    id,
    userId: owner.userId,
    accountType: owner.accountType,
    accountId: owner.accountId,
    title: id,
    updatedAt: new Date("2026-11-21T10:00:00Z"),
  };
}

const personalConversation = conversation("conversation_personal", personalOwner);
const organizationConversation = conversation("conversation_organization", organizationOwner);
const teammateConversation = conversation("conversation_teammate", {
  userId: "user_2",
  accountType: "ORGANIZATION",
  accountId: "org_1",
});

const listed = async (owner: ConversationOwner) =>
  (await listConversations(owner, 5)).map((entry) => entry.id);

describe("listing one account's conversations", () => {
  it("leaves the other account's conversations out, and a teammate's too", async () => {
    dbState.conversations = [personalConversation, organizationConversation, teammateConversation];

    await expect(listed(personalOwner)).resolves.toEqual([personalConversation.id]);
    await expect(listed(organizationOwner)).resolves.toEqual([organizationConversation.id]);
  });

  it("restores the first set when the active account is switched back", async () => {
    dbState.conversations = [personalConversation, organizationConversation];

    const before = await listed(personalOwner);
    await listed(organizationOwner);
    const restored = await listed(personalOwner);

    expect(restored).toEqual(before);
    expect(restored).toEqual([personalConversation.id]);
  });
});
