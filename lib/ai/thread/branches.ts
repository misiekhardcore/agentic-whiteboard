import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { branchableStatus, promptsThrough } from "./rules";

/**
 * Branching a conversation.
 *
 * A branch is a new conversation that begins with a copy of another one's live
 * turns through a chosen reply, so a person can carry the thread somewhere else
 * without losing the one it came from.
 *
 * The copy is history, not work. Every copied prompt records the prompt it came
 * from (`branchedFromId`) and is skipped by the monthly count, because the turn
 * already ran — and was already paid for — in the conversation it belongs to.
 * Copying rather than sharing is what keeps "a prompt belongs to one
 * conversation" true: editing a copied turn rewinds the branch, never the
 * original.
 *
 * The copy keeps the source order exactly, by giving each row a later timestamp
 * than the one before it. A branch is read as one continuous past thread, and
 * the ids are freshly generated, so relying on either `createdAt` alone or on an
 * id tie-break would shuffle turns that the source stored in the same
 * millisecond.
 */

export type BranchResult =
  | { kind: "branched"; conversationId: string }
  /** The reply is not a live turn of this person's conversation. */
  | { kind: "missing" }
  /** The turn has not finished, so there is no settled history to copy. */
  | { kind: "unfinished" };

/** What a refusal says, in the words the person reads. */
export const BRANCH_MISSING = "That reply is no longer part of this conversation.";
export const BRANCH_UNFINISHED = "Wait for the agent to finish this reply before branching it.";

/**
 * Copies one conversation's turns through a reply into a new conversation owned
 * by the same person, and returns the new conversation's id.
 */
export async function branchConversation({
  userId,
  conversationId,
  messageId,
}: {
  userId: string;
  /** The conversation the reply is in. */
  conversationId: string;
  /** The reply to branch from; it and everything before it are copied. */
  messageId: string;
}): Promise<BranchResult> {
  return db.transaction(async (tx) => {
    const [turn] = await tx
      .select({
        id: agentPrompts.id,
        createdAt: agentPrompts.createdAt,
        status: agentPrompts.status,
      })
      .from(agentMessages)
      .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
      .where(
        and(
          eq(agentMessages.id, messageId),
          eq(agentPrompts.userId, userId),
          eq(agentPrompts.conversationId, conversationId),
          isNull(agentPrompts.workspaceId),
          isNull(agentPrompts.supersededAt),
          isNull(agentMessages.supersededAt),
        ),
      )
      .limit(1);

    if (!turn) return { kind: "missing" };
    if (!branchableStatus(turn.status)) return { kind: "unfinished" };

    const live = await tx
      .select({
        id: agentPrompts.id,
        createdAt: agentPrompts.createdAt,
        ownerId: agentPrompts.ownerId,
        provider: agentPrompts.provider,
        model: agentPrompts.model,
      })
      .from(agentPrompts)
      .where(
        and(
          eq(agentPrompts.userId, userId),
          eq(agentPrompts.conversationId, conversationId),
          isNull(agentPrompts.workspaceId),
          isNull(agentPrompts.supersededAt),
        ),
      )
      .orderBy(asc(agentPrompts.createdAt), asc(agentPrompts.id));

    // The same prefix a reload shows, read the same way, so the branch starts
    // where the person was looking rather than a turn off.
    const copied = promptsThrough(live, turn);
    if (copied.length === 0) return { kind: "missing" };

    const sourceMessages = await tx
      .select({
        promptId: agentMessages.promptId,
        role: agentMessages.role,
        actorType: agentMessages.actorType,
        userId: agentMessages.userId,
        content: agentMessages.content,
      })
      .from(agentMessages)
      .where(
        and(
          inArray(
            agentMessages.promptId,
            copied.map((prompt) => prompt.id),
          ),
          isNull(agentMessages.supersededAt),
        ),
      )
      .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

    const byPrompt = new Map<string, typeof sourceMessages>();
    for (const message of sourceMessages) {
      const owned = byPrompt.get(message.promptId) ?? [];
      owned.push(message);
      byPrompt.set(message.promptId, owned);
    }

    const branchId = crypto.randomUUID();
    await tx.insert(agentConversations).values({ id: branchId, userId });

    const base = Date.now();
    let tick = 0;
    const nextMoment = () => new Date(base + tick++);

    for (const prompt of copied) {
      const [copy] = await tx
        .insert(agentPrompts)
        .values({
          ownerId: prompt.ownerId,
          userId,
          conversationId: branchId,
          // History: the copy is finished even when the source turn failed or
          // was stopped, so it can never take the single-flight slot or offer a
          // free retry it was already charged for.
          status: "COMPLETED",
          provider: prompt.provider,
          model: prompt.model,
          branchedFromId: prompt.id,
          createdAt: nextMoment(),
        })
        .returning({ id: agentPrompts.id });

      if (!copy) throw new Error("The branched prompt was not created.");

      for (const message of byPrompt.get(prompt.id) ?? []) {
        await tx.insert(agentMessages).values({
          promptId: copy.id,
          workspaceId: null,
          role: message.role,
          actorType: message.actorType,
          userId: message.userId,
          content: message.content,
          createdAt: nextMoment(),
        });
      }
    }

    return { kind: "branched", conversationId: branchId };
  });
}
