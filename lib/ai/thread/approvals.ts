import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

/**
 * The question the thread is waiting on.
 *
 * A gated tool parks its call until the person answers, and the answer travels
 * through the browser, so it is matched back to the stored request rather than
 * trusted: by the reference the SDK signed, inside the person's own thread, and
 * only while the request is still unanswered. A turn an edit discarded is not
 * answerable even if its card is still open in a stale tab.
 */

/** How long an unanswered approval stays answerable. */
export const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The prompt whose approval the browser just answered, if it may be answered. */
export async function findAwaitingApprovalPrompt(
  userId: string,
  reference: string,
  now: Date = new Date(),
): Promise<{ promptId: string } | null> {
  const [row] = await db
    .select({ id: agentPrompts.id })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.userId, userId),
        isNull(agentPrompts.workspaceId),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
        eq(agentPrompts.status, "AWAITING_APPROVAL"),
        sql`${agentMessages.content} -> 'parts' @> ${JSON.stringify([
          { approval: { id: reference } },
        ])}::jsonb`,
        gt(agentPrompts.createdAt, new Date(now.getTime() - APPROVAL_WINDOW_MS)),
      ),
    )
    .orderBy(desc(agentPrompts.createdAt))
    .limit(1);

  return row ? { promptId: row.id } : null;
}
