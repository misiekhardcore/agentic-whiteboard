import { eq } from "drizzle-orm";

import type { AgentPromptStatus } from "@/lib/collab/contracts";
import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

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
