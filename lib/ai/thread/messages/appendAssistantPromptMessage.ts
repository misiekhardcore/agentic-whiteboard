import { type StoredPromptMessage } from "@/lib/ai/thread/rules";
import { db } from "@/lib/db";
import { agentMessages } from "@/lib/db/schema";

/** Stores the agent's reply, tool calls included, once the stream has ended. */
export async function appendAssistantPromptMessage({
  promptId,
  parts,
}: {
  promptId: string;
  parts: StoredPromptMessage["parts"];
}): Promise<void> {
  await db.insert(agentMessages).values({
    promptId,
    workspaceId: null,
    role: "ASSISTANT",
    actorType: "AGENT",
    content: { parts },
  });
}
