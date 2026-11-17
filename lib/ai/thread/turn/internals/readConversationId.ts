import { conversationIdProblem } from "../../rules";

export /**
 * The conversation the composer is on. Its id is chosen before the first prompt
 * (a UUID the browser makes for "New conversation"), so the route creates the
 * row with the first accepted prompt.
 */
function readConversationId(payload: unknown): { id: string } | { error: string } {
  const raw =
    typeof payload === "object" && payload !== null
      ? (payload as { conversationId?: unknown }).conversationId
      : undefined;
  const problem = conversationIdProblem(typeof raw === "string" ? raw : "");

  return problem ? { error: problem } : { id: raw as string };
}
