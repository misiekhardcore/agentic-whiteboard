import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

/** The stream has started, so the prompt is no longer queued. */
export async function markPromptRunning(promptId: string): Promise<void> {
  await db
    .update(agentPrompts)
    .set({ status: "RUNNING", startedAt: new Date() })
    .where(eq(agentPrompts.id, promptId));
}
