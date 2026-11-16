import { and, asc, count, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";

import {
  addUsage,
  type PromptPosition,
  promptsFromBranch,
  type PromptTarget,
  type StoredPromptMessage,
} from "@/lib/ai/thread/rules";
import type { PlanLimits } from "@/lib/billing/plans";
import type { SubscriptionRow } from "@/lib/billing/subscriptions";
import {
  promptLimitMessage,
  type PromptUsage,
  type UsageWindow,
  usageWindow,
} from "@/lib/billing/usage";
import type { AgentPromptStatus } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { streamingPromptIds } from "./live";

/**
 * Persistence for the dashboard's prompt thread. A prompt row is created when a
 * prompt is accepted and carries its own execution status and usage, so the
 * per-member allowance counts exactly the prompts that ran.
 *
 * A prompt belongs to a conversation, and an edit or a rewind does not delete
 * the turns it replaces: they are marked superseded, which keeps the allowance
 * count and the audit trail while taking them out of the thread.
 */

/** How many prompts this member used in the paying account since `since`. */
export async function countPromptsForMember({
  ownerId,
  userId,
  since,
}: {
  ownerId: string;
  userId: string;
  since: Date;
}): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(agentPrompts)
    .where(
      and(
        eq(agentPrompts.ownerId, ownerId),
        eq(agentPrompts.userId, userId),
        gte(agentPrompts.createdAt, since),
      ),
    );

  return Number(row?.total ?? 0);
}

export type PromptAllowance = {
  usage: PromptUsage;
  window: UsageWindow;
  /** The sentence to show instead of sending, or null when there is room. */
  message: string | null;
};

/**
 * Whether this member may send another prompt. The count belongs to this
 * context (it owns the prompt rows); the window and the copy belong to billing,
 * so the dashboard and the agent endpoint answer the allowance the same way.
 *
 * Superseded prompts are counted: an edit replaced a turn the person already
 * spent a prompt on, and the new one is its own execution.
 */
export async function promptAllowance({
  ownerId,
  userId,
  subscription,
  limits,
  accountName,
}: {
  ownerId: string;
  userId: string;
  subscription: SubscriptionRow | null;
  limits: PlanLimits;
  accountName: string;
}): Promise<PromptAllowance> {
  const window = usageWindow(subscription);
  const used = await countPromptsForMember({ ownerId, userId, since: window.start });
  const limit = limits.agentPromptsPerMonth;

  return {
    usage: {
      used,
      limit,
      periodStart: window.start,
      periodEnd: window.end,
      periodLabel: window.label,
    },
    window,
    message: promptLimitMessage({ used, limit, accountName, periodLabel: window.label }),
  };
}

/**
 * A prompt whose process died keeps its QUEUED/RUNNING status forever and would
 * block the single-flight rule, so the next send retires it first.
 */
const ORPHANED_PROMPT_ERROR =
  "The agent stopped before finishing this prompt. Send it again to retry.";

export type OpenPromptResult =
  | { kind: "opened"; promptId: string }
  | { kind: "busy" }
  /** The conversation id belongs to somebody else, or vanished. */
  | { kind: "missing" };

type StoredContent = { parts: StoredPromptMessage["parts"] };

/**
 * Only a well-formed `{ parts }` object is replayed; anything else would break
 * `useChat`, so an unreadable row is skipped rather than crashing the page.
 */
function storedParts(content: unknown): StoredPromptMessage["parts"] {
  if (typeof content !== "object" || content === null) return [];
  const parts = (content as Partial<StoredContent>).parts;
  return Array.isArray(parts) ? parts : [];
}

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

/** The active prompts on a person's thread that nothing is streaming. */
export function deadThreadPrompts(
  active: readonly { id: string }[],
  streaming: readonly string[],
): string[] {
  const live = new Set(streaming);
  return active.filter((prompt) => !live.has(prompt.id)).map((prompt) => prompt.id);
}

/**
 * Retires the QUEUED/RUNNING prompts nothing is streaming. A restarted server
 * leaves one behind, and it would otherwise block every send until someone
 * cleared it by hand.
 */
async function retireOrphanedPrompts(userId: string): Promise<void> {
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

/**
 * Records an accepted prompt and returns its id. `discardFrom` is the turn an
 * edit replaced: that prompt and every live one after it are marked superseded
 * in the same transaction as the insert, so a reload never shows both the old
 * branch and the new one.
 *
 * A partial unique index allows one QUEUED/RUNNING prompt per person's dashboard
 * thread; a second send while the agent is working reports `busy` instead of
 * running two streams over the same conversation.
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

export type UserPromptTarget = PromptTarget & {
  /** The prompt's place in the conversation, for a rewind's discard set. */
  createdAt: Date;
};

/**
 * The stored user message a send repeats, if any. The browser sends its own
 * message ids, and the composer stores them, so a message the person just sent
 * is findable without a round trip.
 *
 * A superseded prompt still matches: editing the same prompt twice in one
 * session resends the id of the prompt the first edit replaced, and the rewind
 * that follows discards by position.
 */
export async function findUserPromptTarget({
  conversationId,
  messageId,
  userId,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
}): Promise<UserPromptTarget | null> {
  const [row] = await db
    .select({
      promptId: agentPrompts.id,
      promptCreatedAt: agentPrompts.createdAt,
      status: agentPrompts.status,
      content: agentMessages.content,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentMessages.id, messageId),
        eq(agentMessages.role, "USER"),
        isNull(agentMessages.supersededAt),
        eq(agentPrompts.userId, userId),
        eq(agentPrompts.conversationId, conversationId),
        isNull(agentPrompts.workspaceId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const live = await db
    .select({ id: agentPrompts.id, createdAt: agentPrompts.createdAt })
    .from(agentPrompts)
    .where(and(eq(agentPrompts.conversationId, conversationId), isNull(agentPrompts.supersededAt)))
    .orderBy(asc(agentPrompts.createdAt), asc(agentPrompts.id));

  const tip = live[live.length - 1];

  return {
    promptId: row.promptId,
    createdAt: row.promptCreatedAt,
    status: row.status,
    isTip: tip?.id === row.promptId,
    text: storedParts(row.content)
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n"),
  };
}

/** Stores the human message before the response starts, so it survives a reload. */
export async function appendUserPromptMessage({
  promptId,
  userId,
  parts,
  messageId,
}: {
  promptId: string;
  userId: string;
  parts: StoredPromptMessage["parts"];
  /**
   * The browser's message id, kept so the same message can be edited or retried
   * in the session it was sent from. Omitted when a rewind replaces an earlier
   * prompt: that id already names the message being replaced.
   */
  messageId?: string;
}): Promise<void> {
  await db.insert(agentMessages).values({
    ...(messageId ? { id: messageId } : {}),
    promptId,
    workspaceId: null,
    role: "USER",
    actorType: "USER",
    userId,
    content: { parts },
  });
}

/** Stores the agent's reply, tool calls included, once the stream has ended. */
export async function appendAssistantPromptMessage({
  promptId,
  parts,
}: {
  promptId: string;
  parts: StoredPromptMessage["parts"];
}): Promise<void> {
  await db.insert(agentMessages).values({
    promptId,
    workspaceId: null,
    role: "ASSISTANT",
    actorType: "AGENT",
    content: { parts },
  });
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

/** How long an unanswered approval stays answerable. */
export const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The prompt whose approval the browser just answered. Matched through the
 * message that stored the request, by the reference the answer carries, so an
 * answer cannot be attached to a different conversation's question. A turn an
 * edit discarded is not answerable, even if its card is still in a stale tab.
 */
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
