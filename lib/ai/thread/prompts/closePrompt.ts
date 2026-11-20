import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

import { type PromptEnding, promptStatusColumns } from "./transition";

/** Closes the prompt with the status its stream ended in. */
export async function closePrompt({
  promptId,
  status,
  usage,
  error,
}: {
  promptId: string;
  status: PromptEnding;
  usage?: unknown;
  error?: string | null;
}): Promise<void> {
  // A continuation accrues its tokens onto the prompt's existing usage, so a
  // close that carries no usage leaves what is already recorded alone.
  await db
    .update(agentPrompts)
    .set(promptStatusColumns({ transition: "finish", status, error: error ?? null, usage }))
    .where(eq(agentPrompts.id, promptId));
}
