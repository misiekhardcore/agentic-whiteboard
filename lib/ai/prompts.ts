import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";

import type { AgentPromptStatus } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { agentMessages, agentPrompts } from "@/lib/db/schema";

import { threadMessages, type StoredPromptMessage } from "./prompt-thread";

/**
 * Persistence for the dashboard's prompt thread. A prompt row is created when a
 * prompt is accepted and carries its own execution status and usage, so the
 * per-member allowance counts exactly the prompts that ran.
 */

/** How many recent messages the dashboard reloads. */
export const DASHBOARD_THREAD_LIMIT = 40;

/**
 * A prompt whose process died keeps its QUEUED/RUNNING status forever and would
 * block the single-flight rule, so the next send retires it first.
 */
export const STALE_PROMPT_AFTER_MS = 15 * 60 * 1000;
const STALE_PROMPT_ERROR =
  "The agent stopped before finishing this prompt. Send it again to retry.";

export type OpenPromptResult =
  | { kind: "opened"; promptId: string }
  | { kind: "busy" };

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
export async function loadDashboardPromptThread(
  userId: string,
  limit = DASHBOARD_THREAD_LIMIT,
) {
  const rows = await db
    .select({
      id: agentMessages.id,
      role: agentMessages.role,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(eq(agentPrompts.userId, userId), isNull(agentPrompts.workspaceId)),
    )
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/**
 * Records an accepted prompt and returns its id. A partial unique index allows
 * one QUEUED/RUNNING prompt per person's dashboard thread; a second send while
 * the agent is working reports `busy` instead of running two streams over the
 * same conversation.
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
  await db
    .update(agentPrompts)
    .set({
      status: "FAILED",
      error: STALE_PROMPT_ERROR,
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(agentPrompts.userId, userId),
        isNull(agentPrompts.workspaceId),
        inArray(agentPrompts.status, ["QUEUED", "RUNNING"]),
        lt(agentPrompts.createdAt, new Date(Date.now() - STALE_PROMPT_AFTER_MS)),
      ),
    );

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
  await db
    .update(agentPrompts)
    .set({
      status,
      usage: usage ?? null,
      error: error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(agentPrompts.id, promptId));
}
