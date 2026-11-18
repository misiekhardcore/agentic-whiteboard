import type { UIMessage } from "ai";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { promptsThrough, storedParts, threadMessages } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

import { CONVERSATION_THREAD_LIMIT } from "./constants";

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
