import type { UIMessage } from "ai";
import { createAgentUIStreamResponse, generateId } from "ai";

import { createAgent } from "@/lib/ai/runtime/agent";
import {
  buildInstructions,
  DEFAULT_AGENT_INSTRUCTIONS,
  type UiContext,
} from "@/lib/ai/runtime/instructions";
import { createWorkspaceTools } from "@/lib/ai/tools";
import { approvalGatedCapabilityNames } from "@/lib/capabilities/registry";
import { type Change, CHANGE_KEYS_HEADER, changeKeysHeaderValue } from "@/lib/shared/changes";

import { clearThreadStream } from "../live";
import { closePrompt } from "../prompts";

import { jsonError } from "./internals/jsonError";
import { STREAM_ERROR } from "./internals/STREAM_ERROR";
import type { TurnActor } from "./internals/types";
import { persistTurnEnd } from "./persistTurnEnd";
import type { TurnConfig } from "./readTurnConfig";

/**
 * Runs the turn on the model and streams the answer back. The agent is built
 * per turn so its instructions, tools and approval policy match this account;
 * what the stream produced is written when it ends.
 */
export async function streamAgentTurn({
  config,
  actor,
  promptId,
  history,
  continuing,
  changes,
  uiContext,
  signal,
}: {
  config: TurnConfig;
  actor: TurnActor;
  promptId: string;
  /** A new prompt's stored turns, or the browser's own thread for a continuation. */
  history: UIMessage[];
  continuing: boolean;
  /** What the send already changed, announced on the response for this tab. */
  changes: Change[];
  uiContext: UiContext | null;
  signal: AbortSignal;
}): Promise<Response> {
  // Without a secret an approval response could be forged by the browser, so
  // the gated tools are not offered at all rather than offered unprotected.
  const allowApprovalTools = Boolean(config.toolApprovalSecret);

  let failed = false;
  let usageFromStream: unknown = null;
  // What the tools changed while the answer was streaming. The header was sent
  // before they ran, so the reply itself carries these back to this browser.
  const changedByTools = new Set<string>();

  try {
    return await createAgentUIStreamResponse({
      agent: createAgent({
        tools: createWorkspaceTools(actor, {
          promptId,
          allowApprovalTools,
          onChanges: (toolChanges) => {
            for (const change of toolChanges) changedByTools.add(change.key);
          },
        }),
        instructions: buildInstructions(DEFAULT_AGENT_INSTRUCTIONS, uiContext),
        toolsRequiringApproval: allowApprovalTools ? approvalGatedCapabilityNames : undefined,
        toolApprovalSecret: config.toolApprovalSecret,
      }),
      uiMessages: history,
      originalMessages: history,
      generateMessageId: generateId,
      abortSignal: signal,
      // The tab that sent the prompt re-reads its route from this header, so it
      // does not wait for a socket that may not be configured. Other tabs only
      // hear the broadcast.
      ...(changes.length > 0
        ? { headers: { [CHANGE_KEYS_HEADER]: changeKeysHeaderValue(changes) } }
        : {}),
      messageMetadata: ({ part }) =>
        part.type === "finish" && changedByTools.size > 0
          ? { changeKeys: [...changedByTools] }
          : undefined,
      onStepEnd: ({ usage: stepUsage }) => {
        usageFromStream = stepUsage;
      },
      onError: (error) => {
        failed = true;
        console.error(
          "[ai] dashboard prompt stream failed:",
          error instanceof Error ? error.message : String(error),
        );
        return STREAM_ERROR;
      },
      onEnd: async ({ responseMessage, isAborted, isCancelled, outcome }) => {
        await persistTurnEnd({
          promptId,
          userId: actor.userId,
          continuing,
          failed: failed || outcome.status === "failed",
          usage: usageFromStream,
          responseMessage,
          isAborted,
          isCancelled,
        });
      },
    });
  } catch (error) {
    console.error("[ai] could not start the prompt stream:", error);
    clearThreadStream(actor.userId, promptId);
    await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
    return jsonError(STREAM_ERROR, 500);
  }
}
