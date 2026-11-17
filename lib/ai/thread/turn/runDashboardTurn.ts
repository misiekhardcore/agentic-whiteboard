import type { SessionAccountContext } from "@/lib/identity/account";

import { readUiContext } from "./internals/readUiContext";
import type { TurnActor } from "./internals/types";
import { readTurnConfig } from "./readTurnConfig";
import { readTurnRequest } from "./readTurnRequest";
import { resolveTurnPrompt } from "./resolveTurnPrompt";
import { streamAgentTurn } from "./streamAgentTurn";

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

  return streamAgentTurn({
    config,
    actor,
    promptId: resolved.promptId,
    history: resolved.history,
    continuing: resolved.continuing,
    uiContext: readUiContext(payload),
    signal,
  });
}
