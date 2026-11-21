import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

/**
 * The fake decodes each WHERE clause into predicates — an equality or an
 * `is null` — and applies them to the stored conversations, so the requested id
 * and the "latest" fallback are answered by the real queries rather than by
 * queued rows.
 */
const dbState = vi.hoisted(() => ({ conversations: [] as Record<string, unknown>[] }));

type Predicate = (row: Record<string, unknown>) => boolean;

function predicates(condition: unknown): Predicate[] {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
  const found: Predicate[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const column = chunks[index] as { name?: unknown; table?: unknown; queryChunks?: unknown[] };

    if (column?.queryChunks) {
      found.push(...predicates(column));
      continue;
    }

    if (typeof column?.name !== "string" || !column.table) continue;

    const name = column.name;
    const operator = chunks[index + 1] as { value?: unknown };
    const text = Array.isArray(operator?.value) ? operator.value.join("") : "";

    if (text.includes("is null")) {
      found.push((row) => row[name] === null || row[name] === undefined);
      continue;
    }

    const bound = chunks
      .slice(index + 1)
      .map((chunk) => chunk as { value?: unknown })
      .find((chunk) => chunk?.value !== undefined && !Array.isArray(chunk.value));

    if (bound) found.push((row) => row[name] === bound.value);
  }

  return found;
}

const matches = (condition: unknown, row: Record<string, unknown>) =>
  predicates(condition).every((predicate) => predicate(row));

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

const personal: ConversationOwner = { userId: "user_1", organizationId: null };
const organization: ConversationOwner = { userId: "user_1", organizationId: "org_1" };

const personalConversation = {
  id: "conversation_personal",
  userId: "user_1",
  organizationId: null,
  updatedAt: new Date("2026-11-21T10:00:00Z"),
};
const organizationConversation = {
  id: "conversation_organization",
  userId: "user_1",
  organizationId: "org_1",
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
