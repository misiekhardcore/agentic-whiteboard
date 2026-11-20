import { refineConversationTitle } from "@/lib/ai/titles";
import { publishChanges } from "@/lib/capabilities/changes";
import type { SessionAccountContext } from "@/lib/identity/account";

import { readUiContext } from "./internals/readUiContext";
import type { TurnActor } from "./internals/types";
import { readTurnConfig } from "./readTurnConfig";
import { readTurnRequest } from "./readTurnRequest";
import { resolveTurnPrompt } from "./resolveTurnPrompt";
import { streamAgentTurn } from "./streamAgentTurn";
import { turnChanges } from "./turnChanges";

/**
 * One dashboard turn: read the send, decide which stored prompt it continues,
 * then stream the agent's answer and persist what it produced. Each step owns
 * its own module; this function only orders them.
 */
export async function runDashboardTurn({
  payload,
  account,
  signal,
}: {
  payload: unknown;
  account: SessionAccountContext;
  signal: AbortSignal;
}): Promise<Response> {
  const request = readTurnRequest(payload);
  if ("error" in request) return request.error;

  const config = readTurnConfig();
  if ("error" in config) return config.error;

  const { session, activeTeam } = account;
  const actor: TurnActor = {
    userId: session.user.id,
    organizationId: activeTeam?.id ?? null,
    accountName: activeTeam?.name ?? session.user.name,
  };

  const resolved = await resolveTurnPrompt({ request, config, actor });
  if ("error" in resolved) return resolved.error;

  const changes = turnChanges(resolved.continuing);

  if (changes.length > 0) {
    // Announced before the model is asked: the prompt row exists now, so the
    // switcher and the usage meter are already true. A broadcast is a hint, and
    // waiting for it must not delay the answer.
    void publishChanges({
      changes,
      actor: { userId: actor.userId, organizationId: actor.organizationId },
    });
  }

  // A new turn gets the conversation's generated name in the background: the
  // send must not wait for it, and its failure must not cost the person the
  // prompt they paid for. A fork's first prompt is a new turn too, and
  // `refineConversationTitle` is what decides whether a name is still owed.
  if (!resolved.continuing) {
    void refineConversationTitle({
      conversationId: resolved.conversationId,
      userId: actor.userId,
    }).catch((error) => {
      console.error(
        `[ai] titles failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  return streamAgentTurn({
    config,
    actor,
    promptId: resolved.promptId,
    history: resolved.history,
    continuing: resolved.continuing,
    changes,
    uiContext: readUiContext(payload),
    signal,
  });
}
