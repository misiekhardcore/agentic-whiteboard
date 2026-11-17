import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

import { APPROVAL_WINDOW_MS } from "./APPROVAL_WINDOW_MS";

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
