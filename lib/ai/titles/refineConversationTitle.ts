import { and, asc, eq, isNull } from "drizzle-orm";

import { AiConfigurationError } from "@/lib/ai/providers";
import { storedText } from "@/lib/ai/thread/rules";
import { publishChanges } from "@/lib/capabilities/changes";
import { db } from "@/lib/db";
import { agentConversations, agentMessages, agentPrompts } from "@/lib/db/schema";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { isTitleConfigured } from "./config";
import { requestConversationTitle } from "./requestConversationTitle";

const TITLE_TIMEOUT_MS = 15_000;
/** A fork copies its thread; the newest few prompts say what it is about. */
const TITLE_SOURCE_PROMPTS = 3;

async function sourceText(conversationId: string, userId: string): Promise<string> {
  const messages = await db
    .select({ content: agentMessages.content })
    .from(agentMessages)
    .innerJoin(agentPrompts, eq(agentMessages.promptId, agentPrompts.id))
    .where(
      and(
        eq(agentPrompts.conversationId, conversationId),
        eq(agentPrompts.userId, userId),
        eq(agentMessages.role, "USER"),
        isNull(agentPrompts.supersededAt),
        isNull(agentMessages.supersededAt),
      ),
    )
    .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id));

  return messages
    .slice(-TITLE_SOURCE_PROMPTS)
    .map((message) => storedText(message.content))
    .filter((text) => text.trim().length > 0)
    .join("\n");
}

/**
 * Names a conversation once, in the background, from what the person asked.
 *
 * Best-effort by design: an unconfigured endpoint, a model error or an empty
 * answer leaves the derived title in place, because a prompt must never fail
 * over a name. The write is conditional on `titleGeneratedAt` still being null,
 * so two sends cannot both replace it.
 */
export async function refineConversationTitle({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}): Promise<void> {
  const [conversation] = await db
    .select({ titleGeneratedAt: agentConversations.titleGeneratedAt })
    .from(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId)))
    .limit(1);

  if (!conversation || conversation.titleGeneratedAt) return;
  if (!isTitleConfigured()) return;

  let title: string | null;
  try {
    title = await requestConversationTitle({
      source: await sourceText(conversationId, userId),
      signal: AbortSignal.timeout(TITLE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      console.warn(`[ai] titles skipped: ${error.message}`);
    } else {
      console.error(
        `[ai] titles failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return;
  }

  if (!title) return;

  const [updated] = await db
    .update(agentConversations)
    .set({ title, titleGeneratedAt: new Date() })
    .where(
      and(
        eq(agentConversations.id, conversationId),
        eq(agentConversations.userId, userId),
        isNull(agentConversations.titleGeneratedAt),
      ),
    )
    .returning({ id: agentConversations.id });

  if (!updated) return;

  await publishChanges({
    changes: [{ key: CHANGE_KEYS.conversations, scope: "person" }],
    actor: { userId, organizationId: null },
  });
}
