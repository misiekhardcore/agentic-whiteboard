import { type StoredPromptMessage } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentMessages } from "@/lib/db/schema";

/** Stores the human message before the response starts, so it survives a reload. */
export async function appendUserPromptMessage({
  promptId,
  userId,
  parts,
  messageId,
}: {
  promptId: string;
  userId: string;
  parts: StoredPromptMessage["parts"];
  /**
   * The browser's message id, kept so the same message can be edited or retried
   * in the session it was sent from. Omitted when a rewind replaces an earlier
   * prompt: that id already names the message being replaced.
   */
  messageId?: string;
}): Promise<void> {
  await db.insert(agentMessages).values({
    ...(messageId ? { id: messageId } : {}),
    promptId,
    workspaceId: null,
    role: "USER",
    actorType: "USER",
    userId,
    content: { parts },
  });
}
