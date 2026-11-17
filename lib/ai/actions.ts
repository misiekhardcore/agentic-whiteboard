"use server";

import { action } from "@/lib/capabilities/action";

import { branchConversation } from "./capabilities";

/**
 * The dashboard's branch entry point. Thin on purpose: the capability owns the
 * copy, the refusal copy and the paths to revalidate.
 */
const branch = action(branchConversation);

export async function branchConversationAction(input: {
  conversationId: string;
  messageId: string;
}) {
  return branch(input);
}
