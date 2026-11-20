import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentPrompts } from "@/lib/db/schema";

import { streamingPromptIds } from "../live";
import { promptStatusColumns } from "../prompts/transition";

import { deadThreadPrompts } from "./deadThreadPrompts";
import { ORPHANED_PROMPT_ERROR } from "./internals";

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
    .set(promptStatusColumns({ transition: "retire", error: ORPHANED_PROMPT_ERROR }))
    .where(inArray(agentPrompts.id, orphaned));
}
