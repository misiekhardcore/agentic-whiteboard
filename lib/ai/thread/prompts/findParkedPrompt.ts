import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

/**
 * The conversation's prompt that a person's decision is still waiting on. The
 * status is the whole rule: a prompt that was superseded or already resumed is
 * not answerable, whatever card a stale tab still shows.
 */
export async function findParkedPrompt({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}): Promise<{ promptId: string } | null> {
  const [row] = await db
    .select({ id: agentPrompts.id })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
        eq(agentPrompts.status, "AWAITING_APPROVAL"),
      ),
    )
    .orderBy(desc(agentPrompts.createdAt))
    .limit(1);

  return row ? { promptId: row.id } : null;
}
