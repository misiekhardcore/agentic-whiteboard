import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

import { promptStatusColumns } from "./transition";

/** The stream has started, so the prompt is no longer queued. */
export async function markPromptRunning(promptId: string): Promise<void> {
  await db
    .update(agentPrompts)
    .set(promptStatusColumns({ transition: "start" }))
    .where(eq(agentPrompts.id, promptId));
}
