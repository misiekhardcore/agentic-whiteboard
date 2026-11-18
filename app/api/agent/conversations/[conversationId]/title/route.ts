import { readConversationTitle } from "@/lib/ai/thread/conversations";
import { conversationIdProblem } from "@/lib/ai/thread/rules";
import { getSessionAccount } from "@/lib/identity/account";

/**
 * One conversation's generated title, or null until one is stored. The composer
 * asks while it waits, so the pill can swap the derived label for the generated
 * one without reloading the page.
 *
 * The read is scoped by the session's own user: an id from another account
 * selects nothing.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/agent/conversations/[conversationId]/title">,
) {
  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to see this conversation." }, { status: 401 });
  }

  const { conversationId } = await params;
  const problem = conversationIdProblem(conversationId);
  if (problem) {
    return Response.json({ error: problem }, { status: 400 });
  }

  const conversation = await readConversationTitle({
    userId: account.session.user.id,
    conversationId,
  });

  if (!conversation) {
    return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  }

  return Response.json({ title: conversation.title }, { headers: { "Cache-Control": "no-store" } });
}
