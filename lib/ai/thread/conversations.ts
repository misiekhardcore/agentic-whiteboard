import type { UIMessage } from "ai";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  conversationPreview,
  type DashboardConversation,
  promptCanRetry,
  promptsThrough,
  storedParts,
  storedText,
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
 * What the model is shown for one turn: the conversation's live turns up to and
 * including this prompt, oldest first.
 *
 * This is the turn's only history. The browser's array is not one — it is a
 * client's mirror, so a stale tab could replay a discarded branch or invent
 * turns the thread never had. Reading it back here means a body that carries
 * superseded or foreign messages answers exactly like a clean one.
 */
export async function loadPromptHistory({
  promptId,
  userId,
}: {
  promptId: string;
  userId: string;
}): Promise<UIMessage[]> {
  const [prompt] = await db
    .select({
      conversationId: agentPrompts.conversationId,
      id: agentPrompts.id,
      createdAt: agentPrompts.createdAt,
    })
    .from(agentPrompts)
    .where(and(eq(agentPrompts.id, promptId), eq(agentPrompts.userId, userId)))
    .limit(1);

  if (!prompt?.conversationId) return [];

  const live = await db
    .select({ id: agentPrompts.id, createdAt: agentPrompts.createdAt })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, prompt.conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
      ),
    )
    .orderBy(asc(agentPrompts.createdAt), asc(agentPrompts.id));

  const promptIds = promptsThrough(live, prompt).map((turn) => turn.id);

  const rows = await db
    .select({
      id: agentMessages.id,
      role: agentMessages.role,
      content: agentMessages.content,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(and(inArray(agentMessages.promptId, promptIds), isNull(agentMessages.supersededAt)))
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

  // The same window the dashboard reloads, so a long conversation costs the
  // model what it cost before this history came from the database.
  return threadMessages(
    rows.slice(-CONVERSATION_THREAD_LIMIT).map((row) => ({
      id: row.id,
      role: row.role,
      parts: storedParts(row.content),
    })),
  );
}

/**
 * A person's conversations, newest first, labelled by the first prompt still in
 * each thread. The switcher asks for the recent few and the history dialog for
 * the whole list, so both read the same rows the same way; only the count
 * differs.
 *
 * A conversation with no live prompt has nothing to show or open, so it is not
 * listed.
 */
export async function listConversations(
  userId: string,
  limit: number,
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
    previews.set(message.conversationId, storedText(message.content));
  }

  return conversations.map((conversation) => ({
    id: conversation.id,
    updatedAt: conversation.updatedAt,
    preview: conversationPreview(previews.get(conversation.id) ?? ""),
  }));
}
