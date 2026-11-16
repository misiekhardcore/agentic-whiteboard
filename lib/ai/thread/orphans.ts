import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

import { streamingPromptIds } from "./live";

/**
 * The prompts nothing is working on.
 *
 * A prompt row is a lease on the person's thread, and the stream that owns it
 * lives in the process that opened it: a restart mid-reply leaves the row
 * QUEUED or RUNNING forever. No timestamp can tell that row from a healthy slow
 * model, so the process's own registry of what it is streaming is the only
 * authority — anything active it is not streaming was left by a server that has
 * since gone.
 *
 * Retiring it as FAILED is what keeps a restart from blocking the thread, and
 * what makes it retryable for free once it is.
 */

/**
 * The error a retired prompt carries, so the person is told what happened
 * instead of finding a reply that stops mid-sentence.
 */
const ORPHANED_PROMPT_ERROR =
  "The agent stopped before finishing this prompt. Send it again to retry.";

/** The active prompts on a person's thread that nothing is streaming. */
export function deadThreadPrompts(
  active: readonly { id: string }[],
  streaming: readonly string[],
): string[] {
  const live = new Set(streaming);
  return active.filter((prompt) => !live.has(prompt.id)).map((prompt) => prompt.id);
}

/**
 * Retires the QUEUED/RUNNING prompts nothing is streaming. Called before a send
 * opens or reuses a prompt, because that row would otherwise hold the
 * single-flight slot against a thread nobody is working on.
 */
export async function retireOrphanedPrompts(userId: string): Promise<void> {
  const active = await db
    .select({ id: agentPrompts.id })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.userId, userId),
        isNull(agentPrompts.workspaceId),
        inArray(agentPrompts.status, ["QUEUED", "RUNNING"]),
      ),
    );

  const orphaned = deadThreadPrompts(active, streamingPromptIds(userId));
  if (orphaned.length === 0) return;

  await db
    .update(agentPrompts)
    .set({ status: "FAILED", error: ORPHANED_PROMPT_ERROR, finishedAt: new Date() })
    .where(inArray(agentPrompts.id, orphaned));
}
