import { type AgentPanelViewPayload, loadConversationSet } from "@/lib/ai/thread/conversations";
import { getSessionAccount } from "@/lib/identity/account";
import { readPersonalSettings } from "@/lib/identity/settings";

/**
 * One conversation as a mounted composer reads it. The panel lives in the
 * workspaces layout, where the URL is client state, so it asks for the same
 * conversation set the dashboard's server section renders with
 * `loadConversationSet`.
 *
 * The conversation is `?conversation=<id>`: an id the session does not own in
 * the active account is replaced by that account's latest thread, and no id
 * means the latest thread (or a fresh one), exactly as on the dashboard.
 */
export async function GET(request: Request): Promise<Response> {
  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to open a conversation." }, { status: 401 });
  }

  const userId = account.session.user.id;
  const requested = new URL(request.url).searchParams.get("conversation") ?? undefined;

  const [conversationSet, settings] = await Promise.all([
    loadConversationSet({
      owner: { userId, organizationId: account.activeOrganizationId },
      requested,
    }),
    readPersonalSettings(userId),
  ]);

  const payload: AgentPanelViewPayload = {
    conversationId: conversationSet.conversationId,
    messages: conversationSet.messages,
    canRetry: conversationSet.canRetry,
    conversations: conversationSet.conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    })),
    readAloud: settings.readAloud,
    readAloudVoice: settings.readAloudVoice,
  };

  return Response.json(payload);
}
