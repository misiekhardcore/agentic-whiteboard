import { z } from "zod";

import {
  capabilityFailureSchema,
  defineCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import {
  BRANCH_MISSING,
  BRANCH_UNFINISHED,
  branchConversation as branchConversationInto,
} from "./thread/branches";
import { conversationIdProblem } from "./thread/rules";

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
  invalidates: () => [routes.dashboard],
  handler: async (ctx, input) => {
    const result = await branchConversationInto({
      userId: ctx.actor.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    });

    if (result.kind === "missing") return failure(BRANCH_MISSING);
    if (result.kind === "unfinished") return failure(BRANCH_UNFINISHED);

    return success({ conversationId: result.conversationId });
  },
});
