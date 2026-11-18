import type { UIMessage } from "ai";

import { getOrganizationEntitlements, getUserEntitlements } from "@/lib/billing/entitlements";

import { promptAllowance } from "../allowance";
import { markThreadStream } from "../live";
import { openDashboardPrompt } from "../prompts";
import type { PromptPosition } from "../rules";
import { scheduleConversationTitle } from "../titles";

import { BUSY, CONVERSATION_MISSING } from "./internals/constants";
import { jsonError } from "./internals/jsonError";
import { recordTurn } from "./internals/recordTurn";
import type { TurnActor, TurnFailure } from "./internals/types";

/**
 * Opens a new prompt for this send: refuses when the account is out of
 * allowance, inserts the prompt (dropping the turns an edit replaced) and reads
 * the turn's history back from what was stored.
 */
export async function openNewTurn({
  conversationId,
  actor,
  provider,
  model,
  submitted,
  discardFrom,
  keepMessageId,
}: {
  conversationId: string;
  actor: TurnActor;
  provider: string;
  model: string;
  /** The user message this send carries. */
  submitted: UIMessage;
  /** The turn an edit replaces, when this send rewinds the conversation. */
  discardFrom?: PromptPosition;
  /** Keep the browser's message id, which is what makes a prompt editable. */
  keepMessageId: boolean;
}): Promise<{ promptId: string; history: UIMessage[] } | TurnFailure> {
  const { userId, organizationId, accountName } = actor;
  const ownerId = organizationId ?? userId;

  const entitlements = organizationId
    ? await getOrganizationEntitlements(organizationId)
    : await getUserEntitlements(userId);

  const allowance = await promptAllowance({
    ownerId,
    userId,
    subscription: entitlements.subscription,
    limits: entitlements.limits,
    accountName,
  });
  if (allowance.message) {
    return { error: jsonError(allowance.message, 402, { limitReached: true }) };
  }

  const opened = await openDashboardPrompt({
    conversationId,
    ownerId,
    userId,
    provider,
    model,
    discardFrom,
  });
  if (opened.kind === "busy") {
    return { error: jsonError(BUSY, 409) };
  }
  if (opened.kind === "missing") {
    return { error: jsonError(CONVERSATION_MISSING, 404) };
  }

  // Marked before the next await, so a parallel send cannot mistake this
  // QUEUED row for an orphan and retire it out from under the stream.
  markThreadStream(userId, opened.promptId);

  const recorded = await recordTurn({
    promptId: opened.promptId,
    userId,
    submitted,
    keepMessageId,
  });
  if ("error" in recorded) return recorded;

  // Naming is a request of its own, scheduled after this response; it reads the
  // stored first message rather than the browser's body. A retry and an
  // approval answer reuse a prompt and leave the name alone.
  scheduleConversationTitle({ conversationId, userId });

  return { promptId: opened.promptId, history: recorded.history };
}
