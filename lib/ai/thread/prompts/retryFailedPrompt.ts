import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { retireOrphanedPrompts } from "../orphans";

import { isUniqueViolation } from "./internals";
import type { RetryPromptResult } from "./types";

/**
 * Re-runs a prompt that failed, reusing its row so the person is not charged
 * twice for one request. Only the conversation's newest prompt that failed is
 * eligible; the caller decides that from the intent rule before asking.
 *
 * The status change is a compare-and-swap on `FAILED`, so the loser of a race —
 * a second retry of the same prompt, or an edit that replaced the turn — reports
 * `expired` instead of streaming a prompt that is already somebody else's. The
 * single-flight index can also fire when another conversation holds a live
 * prompt, which reports `busy`; both leave the failed turn exactly as it was,
 * because nothing but the swap happens before it succeeds.
 *
 * The failed attempt's replies are superseded rather than deleted — the prompt's
 * own text stays — so the reloaded thread shows one prompt with one answer.
 */
export async function retryFailedPrompt({
  conversationId,
  promptId,
  userId,
}: {
  conversationId: string;
  promptId: string;
  userId: string;
}): Promise<RetryPromptResult> {
  // A retry is a send too: the row a restarted server left RUNNING must not be
  // mistaken for a live turn and answered with `busy` forever.
  await retireOrphanedPrompts(userId);

  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const [resumed] = await tx
        .update(agentPrompts)
        .set({ status: "RUNNING", error: null, finishedAt: null, startedAt: now })
        .where(
          and(
            eq(agentPrompts.id, promptId),
            eq(agentPrompts.userId, userId),
            eq(agentPrompts.conversationId, conversationId),
            isNull(agentPrompts.workspaceId),
            isNull(agentPrompts.supersededAt),
            eq(agentPrompts.status, "FAILED"),
          ),
        )
        .returning({ id: agentPrompts.id });

      if (!resumed) return "expired";

      await tx
        .update(agentMessages)
        .set({ supersededAt: now })
        .where(
          and(
            eq(agentMessages.promptId, promptId),
            eq(agentMessages.role, "ASSISTANT"),
            isNull(agentMessages.supersededAt),
          ),
        );

      await tx
        .update(agentConversations)
        .set({ updatedAt: now })
        .where(eq(agentConversations.id, conversationId));

      return "resumed";
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "busy";
    throw error;
  }
}
