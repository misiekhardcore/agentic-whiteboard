import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { type PromptPosition, promptsFromBranch } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentConversations, agentPrompts } from "@/lib/db/schema";

import { retireOrphanedPrompts } from "../orphans";

import { isUniqueViolation } from "./internals";
import type { OpenPromptResult } from "./types";

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
