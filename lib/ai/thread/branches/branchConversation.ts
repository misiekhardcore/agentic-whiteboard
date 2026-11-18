import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";

import { branchableStatus, promptsThrough } from "../rules";

import type { BranchResult } from "./types";

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
