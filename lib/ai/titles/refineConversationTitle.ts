import { and, eq, isNull } from "drizzle-orm";

import { AiConfigurationError } from "@/lib/ai/providers";
import { liveConversationTurns } from "@/lib/ai/thread/conversations";
import { storedText } from "@/lib/ai/thread/rules";
import { publishChanges } from "@/lib/capabilities/changes";
import { db } from "@/lib/db";
import { agentConversations } from "@/lib/db/schema";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { isTitleConfigured } from "./config";
import { requestConversationTitle } from "./requestConversationTitle";

const TITLE_TIMEOUT_MS = 15_000;
/** A fork copies its thread; the newest few prompts say what it is about. */
const TITLE_SOURCE_PROMPTS = 3;

async function sourceText(conversationId: string, userId: string): Promise<string> {
  const turns = await liveConversationTurns({ userId, conversationId });

  return turns
    .flatMap((turn) => turn.messages)
    .filter((message) => message.role === "USER")
    .map((message) => storedText(message.content))
    .filter((text) => text.trim().length > 0)
    .slice(-TITLE_SOURCE_PROMPTS)
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

  // A turn with no readable prompt text has nothing to name, and the slot can
  // only be written once — spending the model call on it would lock in a name
  // nobody asked for.
  const source = await sourceText(conversationId, userId);
  if (!source.trim()) return;

  let title: string | null;
  try {
    title = await requestConversationTitle({
      source,
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
