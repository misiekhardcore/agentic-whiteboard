import { z } from "zod";

import {
  capabilityFailureSchema,
  defineCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import {
  BRANCH_MISSING,
  BRANCH_UNFINISHED,
  branchConversation as branchConversationInto,
} from "./thread/branches";
import { conversationIdProblem, conversationOwner } from "./thread/rules";
import { refineConversationTitle } from "./titles";

/**
 * The dashboard thread's operations that are not a prompt.
 *
 * Branching is human-only: it copies a conversation's finished turns into a new
 * one where the person keeps going. An agent forking the thread it is working in
 * is a different decision, and not this one.
 */
export const branchConversation = defineCapability({
  name: "branchConversation",
  description:
    "Start a new conversation that begins with a copy of this one's turns, through a chosen reply.",
  input: z.object({
    conversationId: z
      .string()
      .refine((id) => conversationIdProblem(id) === null, "Send the conversation to branch."),
    messageId: z.string().min(1).max(100),
  }),
  output: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), conversationId: z.string() }),
    capabilityFailureSchema,
  ]),
  callers: ["human"] as const,
  changes: () => [{ key: CHANGE_KEYS.conversations, scope: "person" }],
  handler: async (ctx, input) => {
    // The branch continues a thread of the active account, so it is filed in the
    // same one; the source read already requires it.
    const owner = conversationOwner({
      userId: ctx.actor.userId,
      organizationId: ctx.actor.organizationId,
    });

    const result = await branchConversationInto({
      owner,
      conversationId: input.conversationId,
      messageId: input.messageId,
    });

    if (result.kind === "missing") return failure(BRANCH_MISSING);
    if (result.kind === "unfinished") return failure(BRANCH_UNFINISHED);

    // The fork is named from what it copied, in the background; the copy is
    // already complete without a generated title.
    void refineConversationTitle({
      conversationId: result.conversationId,
      owner,
    }).catch((error) => {
      console.error(
        `[ai] titles failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return success({ conversationId: result.conversationId });
  },
});
