import type { UIMessage } from "ai";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  conversationPreview,
  type DashboardConversation,
  promptCanRetry,
  threadMessages,
} from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

/**
 * Reads for the dashboard's conversations: which thread is open, its stored
 * messages, and the recent list the switcher offers.
 *
 * A conversation is the person's, so every read is scoped by `userId` and never
 * by an id alone: the ids reach the browser, and an id from another account must
 * select nothing.
 */

/** How many past conversations the switcher offers. */
export const RECENT_CONVERSATION_LIMIT = 5;

/** How many recent messages a conversation reloads. */
export const CONVERSATION_THREAD_LIMIT = 40;

type StoredContent = { parts: unknown };

/**
 * Only a well-formed `{ parts }` array is replayed; anything else would break
 * `useChat`, so an unreadable row is skipped rather than crashing the page.
 */
function storedParts(content: unknown): UIMessage["parts"] {
  if (typeof content !== "object" || content === null) return [];
  const parts = (content as Partial<StoredContent>).parts;
  return Array.isArray(parts) ? (parts as UIMessage["parts"]) : [];
}

function firstText(content: unknown): string {
  return storedParts(content)
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

/**
 * The conversation a person sees: the one the URL names, otherwise the one they
 * last used, otherwise a fresh id for an empty thread.
 *
 * A named id that does not exist yet is a "New conversation" the composer has
 * not sent into: it is used as-is, so a reload keeps the empty thread and the
 * first prompt creates the row. A named id belonging to somebody else is not
 * theirs to open, so it is replaced rather than answered.
 */
export async function resolveActiveConversation({
  userId,
  requested,
}: {
  userId: string;
  requested?: string;
}): Promise<string> {
  if (requested) {
    const [owned] = await db
      .select({ userId: agentConversations.userId })
      .from(agentConversations)
      .where(eq(agentConversations.id, requested))
      .limit(1);

    if (!owned || owned.userId === userId) return requested;
  }

  const [latest] = await db
    .select({ id: agentConversations.id })
    .from(agentConversations)
    .where(eq(agentConversations.userId, userId))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(1);

  return latest?.id ?? crypto.randomUUID();
}

/**
 * One conversation's live thread, oldest first, plus whether its last prompt
 * failed — the one ending a retry may reuse. Superseded prompts are turns an
 * edit replaced, and superseded messages are failed replies a retry replaced;
 * neither is replayed.
 */
export async function loadConversationThread({
  userId,
  conversationId,
  limit = CONVERSATION_THREAD_LIMIT,
}: {
  userId: string;
  conversationId: string;
  limit?: number;
}): Promise<{ messages: UIMessage[]; canRetry: boolean }> {
  const rows = await db
    .select({
      id: agentMessages.id,
      role: agentMessages.role,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
      ),
    )
    .orderBy(desc(agentMessages.createdAt), desc(agentMessages.id))
    .limit(limit);

  const [tip] = await db
    .select({ status: agentPrompts.status })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
      ),
    )
    .orderBy(desc(agentPrompts.createdAt), desc(agentPrompts.id))
    .limit(1);

  return {
    messages: threadMessages(
      rows.reverse().map((row) => ({
        id: row.id,
        role: row.role,
        parts: storedParts(row.content),
      })),
    ),
    canRetry: tip ? promptCanRetry(tip.status) : false,
  };
}

/**
 * The recent conversations the switcher lists, newest first, labelled by the
 * first prompt still in each thread. A conversation with no live prompt has
 * nothing to show or open, so it is not listed.
 */
export async function listRecentConversations(
  userId: string,
  limit = RECENT_CONVERSATION_LIMIT,
): Promise<DashboardConversation[]> {
  const conversations = await db
    .select({ id: agentConversations.id, updatedAt: agentConversations.updatedAt })
    .from(agentConversations)
    .where(eq(agentConversations.userId, userId))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(limit);

  if (conversations.length === 0) return [];

  const ids = conversations.map((conversation) => conversation.id);
  const firstMessages = await db
    .select({
      conversationId: agentPrompts.conversationId,
      content: agentMessages.content,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentMessages.role, "USER"),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
        inArray(agentPrompts.conversationId, ids),
      ),
    )
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

  const previews = new Map<string, string>();
  for (const message of firstMessages) {
    if (!message.conversationId || previews.has(message.conversationId)) continue;
    previews.set(message.conversationId, firstText(message.content));
  }

  return conversations.map((conversation) => ({
    id: conversation.id,
    updatedAt: conversation.updatedAt,
    preview: conversationPreview(previews.get(conversation.id) ?? ""),
  }));
}
