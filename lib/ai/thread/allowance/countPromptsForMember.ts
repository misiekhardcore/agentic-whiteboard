import { and, count, eq, gte, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

/**
 * The person's monthly prompt allowance, as the prompt rows see it.
 *
 * The count is this context's — it owns the prompt rows, and a prompt is the
 * billing unit — while the window and the refusal copy belong to billing, so the
 * dashboard and the agent endpoint answer the allowance the same way.
 *
 * Superseded prompts are counted: an edit replaced a turn the person already
 * spent a prompt on, and the new one is its own execution. A branched prompt is
 * not counted: it is a copy of a turn that already ran, kept so another
 * conversation has the history without charging for it twice.
 */
/** How many prompts this member used in the paying account since `since`. */
export async function countPromptsForMember({
  organizationId,
  userId,
  since,
}: {
  organizationId: string | null;
  userId: string;
  since: Date;
}): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(agentPrompts)
    .where(
      and(
        organizationId === null
          ? isNull(agentPrompts.organizationId)
          : eq(agentPrompts.organizationId, organizationId),
        eq(agentPrompts.userId, userId),
        gte(agentPrompts.createdAt, since),
        isNull(agentPrompts.branchedFromId),
      ),
    );

  return Number(row?.total ?? 0);
}
