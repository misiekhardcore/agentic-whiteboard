import { eq } from "drizzle-orm";

import { addUsage } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

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
