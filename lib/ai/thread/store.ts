import { and, count, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";

import { addUsage, type StoredPromptMessage, threadMessages } from "@/lib/ai/thread/rules";
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
import { agentMessages, agentPrompts } from "@/lib/db/schema";

import { streamingPromptIds } from "./live";

/**
 * Persistence for the dashboard's prompt thread. A prompt row is created when a
 * prompt is accepted and carries its own execution status and usage, so the
 * per-member allowance counts exactly the prompts that ran.
 */

/** How many recent messages the dashboard reloads. */
export const DASHBOARD_THREAD_LIMIT = 40;

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

export type OpenPromptResult = { kind: "opened"; promptId: string } | { kind: "busy" };

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

/**
 * The signed-in person's dashboard thread, oldest first. Messages of a
 * workspace conversation are excluded: this thread belongs to the person, not
 * to a workspace.
 */
export async function loadDashboardPromptThread(userId: string, limit = DASHBOARD_THREAD_LIMIT) {
  const rows = await db
    .select({
      id: agentMessages.id,
      role: agentMessages.role,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(and(eq(agentPrompts.userId, userId), isNull(agentPrompts.workspaceId)))
    .orderBy(desc(agentMessages.createdAt), desc(agentMessages.id))
    .limit(limit);

  return threadMessages(
    rows.reverse().map((row) => ({
      id: row.id,
      role: row.role,
      parts: storedParts(row.content),
    })),
  );
}

/**
 * The active prompts on a person's thread that nothing is streaming.
 *
 * A prompt is only alive while the request that created it holds its stream, so
 * anything missing from this process's registry was left behind by a server that
 * has since gone. Deliberately not a timestamp comparison: a slow model can hold
 * one prompt for longer than any lease we would pick, and two times were ever
 * guesswork.
 */
export function deadThreadPrompts(
  active: readonly { id: string }[],
  streaming: readonly string[],
): string[] {
  const live = new Set(streaming);
  return active.filter((prompt) => !live.has(prompt.id)).map((prompt) => prompt.id);
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

/**
 * Records an accepted prompt and returns its id. A partial unique index allows
 * one QUEUED/RUNNING prompt per person's dashboard thread; a second send while
 * the agent is working reports `busy` instead of running two streams over the
 * same conversation.
 *
 * Retiring an orphan first is what makes a restart recoverable: the row a killed
 * server left behind would otherwise block every send until someone cleared it by
 * hand.
 */
export async function openDashboardPrompt({
  ownerId,
  userId,
  provider,
  model,
}: {
  ownerId: string;
  userId: string;
  provider: string;
  model: string;
}): Promise<OpenPromptResult> {
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

  if (orphaned.length > 0) {
    await db
      .update(agentPrompts)
      .set({
        status: "FAILED",
        error: ORPHANED_PROMPT_ERROR,
        finishedAt: new Date(),
      })
      .where(inArray(agentPrompts.id, orphaned));
  }

  try {
    const [created] = await db
      .insert(agentPrompts)
      .values({ ownerId, userId, provider, model })
      .returning({ id: agentPrompts.id });

    if (!created) throw new Error("The prompt row was not created.");
    return { kind: "opened", promptId: created.id };
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

/** Stores the human message before the response starts, so it survives a reload. */
export async function appendUserPromptMessage({
  promptId,
  userId,
  parts,
}: {
  promptId: string;
  userId: string;
  parts: StoredPromptMessage["parts"];
}): Promise<void> {
  await db.insert(agentMessages).values({
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
 * answer cannot be attached to a different conversation's question.
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

/** Puts an answered prompt back into RUNNING without restarting its clock. */
export async function resumePrompt(promptId: string): Promise<void> {
  await db.update(agentPrompts).set({ status: "RUNNING" }).where(eq(agentPrompts.id, promptId));
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
