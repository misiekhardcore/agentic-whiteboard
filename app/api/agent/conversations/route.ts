import { listConversations } from "@/lib/ai/thread/conversations";
import { CONVERSATION_HISTORY_LIMIT, type ConversationHistoryEntry } from "@/lib/ai/thread/rules";
import { getSessionAccount } from "@/lib/identity/account";

/**
 * The session's conversations, newest first, for the dashboard's history
 * dialog. The dialog asks when it opens rather than receiving the list with the
 * page: a person may have hundreds of conversations, and most dashboard visits
 * never look at them.
 *
 * The read is scoped by the session's own user, so no id in the request can
 * select somebody else's thread.
 */
export async function GET(): Promise<Response> {
  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to see your conversations." }, { status: 401 });
  }

  const conversations = await listConversations(
    account.session.user.id,
    CONVERSATION_HISTORY_LIMIT,
  );

  return Response.json({
    conversations: conversations.map((conversation): ConversationHistoryEntry => ({
      id: conversation.id,
      preview: conversation.preview,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    })),
  });
}
