import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { addUsage, type PromptPosition, promptsFromBranch } from "@/lib/ai/thread/rules";
import type { AgentPromptStatus } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { retireOrphanedPrompts } from "./orphans";

/**
 * The prompt row's life. A prompt is created when a send is accepted, runs as a
 * status on that row, and is closed with the status its stream ended in; a retry
 * and an answered approval reopen the same row, because the person already paid
 * for it.
 *
 * Everything that opens or reopens a row goes through the single-flight rule —
 * one QUEUED/RUNNING prompt per person's dashboard thread, enforced by a partial
 * unique index — so each of those paths says which way it lost rather than
 * throwing: `busy` when another stream holds the slot, `expired` when the row is
 * no longer the one to reuse. A row nothing has streamed since a restart is
 * retired first, so a dead prompt cannot hold the slot against the person.
 *
 * A prompt belongs to a conversation, and an edit does not delete the turns it
 * replaces: they are marked superseded, which keeps the allowance count and the
 * audit trail while taking them out of the thread.
 */

const UNIQUE_VIOLATION = "23505";

/**
 * Whether the driver refused a write on a unique index. Drizzle wraps every
 * failed query in a `DrizzleQueryError` and keeps the driver's error as `cause`,
 * so the SQLSTATE is one level down — reading only the wrapper made a busy thread
 * surface as a 500 instead of the 409 the send path means to report.
 */
function isUniqueViolation(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

export type OpenPromptResult =
  | { kind: "opened"; promptId: string }
  | { kind: "busy" }
  /** The conversation id belongs to somebody else, or vanished. */
  | { kind: "missing" };

/**
 * Records an accepted prompt and returns its id. `discardFrom` is the turn an
 * edit replaced: that prompt and every live one after it are marked superseded
 * in the same transaction as the insert, so a reload never shows both the old
 * branch and the new one.
 *
 * The conversation row is created here, in the same transaction, because a
 * conversation exists exactly when it has a prompt in it — "New conversation" is
 * a URL, not a write, and the first accepted prompt is what makes the row real.
 */
export async function openDashboardPrompt({
  conversationId,
  ownerId,
  userId,
  provider,
  model,
  discardFrom,
}: {
  conversationId: string;
  ownerId: string;
  userId: string;
  provider: string;
  model: string;
  /** The prompt an edit branched from, if this send replaces a turn. */
  discardFrom?: PromptPosition;
}): Promise<OpenPromptResult> {
  await retireOrphanedPrompts(userId);

  try {
    return await db.transaction(async (tx) => {
      // The first prompt of a conversation creates it. A conflict means the id
      // already exists, so it is only usable when it is this person's.
      await tx
        .insert(agentConversations)
        .values({ id: conversationId, userId })
        .onConflictDoNothing();

      const [conversation] = await tx
        .select({ userId: agentConversations.userId })
        .from(agentConversations)
        .where(eq(agentConversations.id, conversationId))
        .limit(1);

      if (!conversation || conversation.userId !== userId) {
        return { kind: "missing" };
      }

      // Read before inserting: the new prompt must not be part of its own
      // discard set, and the old branch is still live at this point.
      const discarded = discardFrom
        ? promptsFromBranch(
            await tx
              .select({ id: agentPrompts.id, createdAt: agentPrompts.createdAt })
              .from(agentPrompts)
              .where(
                and(
                  eq(agentPrompts.conversationId, conversationId),
                  isNull(agentPrompts.supersededAt),
                ),
              )
              .orderBy(asc(agentPrompts.createdAt), asc(agentPrompts.id)),
            discardFrom,
          )
        : [];

      const [created] = await tx
        .insert(agentPrompts)
        .values({ ownerId, userId, conversationId, provider, model })
        .returning({ id: agentPrompts.id });

      if (!created) throw new Error("The prompt row was not created.");

      const now = new Date();

      if (discarded.length > 0) {
        await tx
          .update(agentPrompts)
          .set({ supersededAt: now })
          .where(
            inArray(
              agentPrompts.id,
              discarded.map((prompt) => prompt.id),
            ),
          );
      }

      await tx
        .update(agentConversations)
        .set({ updatedAt: now })
        .where(eq(agentConversations.id, conversationId));

      return { kind: "opened", promptId: created.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { kind: "busy" };
    throw error;
  }
}

/** The stream has started, so the prompt is no longer queued. */
export async function markPromptRunning(promptId: string): Promise<void> {
  await db
    .update(agentPrompts)
    .set({ status: "RUNNING", startedAt: new Date() })
    .where(eq(agentPrompts.id, promptId));
}

export type RetryPromptResult = "resumed" | "busy" | "expired";

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

export type ResumePromptResult = "resumed" | "busy";

/**
 * Puts an answered prompt back into RUNNING without restarting its clock.
 *
 * A parked prompt waits outside the single-flight index, so another send may
 * have taken the slot while its approval sat unanswered; the resume then hits
 * that index. Reporting `busy` leaves the prompt parked and still answerable
 * instead of failing the request outright.
 */
export async function resumePrompt(promptId: string): Promise<ResumePromptResult> {
  try {
    await db.update(agentPrompts).set({ status: "RUNNING" }).where(eq(agentPrompts.id, promptId));
    return "resumed";
  } catch (error) {
    if (isUniqueViolation(error)) return "busy";
    throw error;
  }
}

/** Closes the prompt with the status its stream ended in. */
export async function closePrompt({
  promptId,
  status,
  usage,
  error,
}: {
  promptId: string;
  status: AgentPromptStatus;
  usage?: unknown;
  error?: string | null;
}): Promise<void> {
  const closed: {
    status: AgentPromptStatus;
    error: string | null;
    finishedAt: Date;
    usage?: unknown;
  } = { status, error: error ?? null, finishedAt: new Date() };

  // A continuation accrues its tokens onto the prompt's existing usage, so a
  // close that carries no usage must not erase what is already recorded.
  if (usage !== undefined) closed.usage = usage;

  await db.update(agentPrompts).set(closed).where(eq(agentPrompts.id, promptId));
}

/** Adds a continuation's tokens to what the prompt already recorded. */
export async function accruePromptUsage(promptId: string, usage: unknown): Promise<void> {
  const [row] = await db
    .select({ usage: agentPrompts.usage })
    .from(agentPrompts)
    .where(eq(agentPrompts.id, promptId));

  if (!row) return;

  await db
    .update(agentPrompts)
    .set({ usage: addUsage(row.usage, usage) })
    .where(eq(agentPrompts.id, promptId));
}
