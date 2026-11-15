import { createAgentUIStreamResponse, generateId, type UIMessage } from "ai";

import { AiConfigurationError, getAiConfig } from "@/lib/ai/providers/config";
import { createAgent } from "@/lib/ai/runtime/agent";
import {
  buildInstructions,
  DEFAULT_AGENT_INSTRUCTIONS,
  type UiContext,
  uiContextSchema,
} from "@/lib/ai/runtime/instructions";
import { createWorkspaceTools } from "@/lib/ai/tools";
import { getOrganizationEntitlements, getUserEntitlements } from "@/lib/billing/entitlements";
import { approvalGatedCapabilityNames } from "@/lib/capabilities/registry";
import type { SessionAccountContext } from "@/lib/identity/account";

import { clearThreadStream, markThreadStream } from "./live";
import {
  approvalReference,
  hasPendingApproval,
  lastUserText,
  promptProblem,
  promptRequestKind,
  promptStatusAfterStream,
} from "./rules";
import {
  accruePromptUsage,
  appendAssistantPromptMessage,
  appendUserPromptMessage,
  closePrompt,
  findAwaitingApprovalPrompt,
  markPromptRunning,
  openDashboardPrompt,
  promptAllowance,
  resumePrompt,
} from "./store";

/**
 * One dashboard prompt turn: what the client must not decide — who is asking,
 * which account pays, whether the allowance has room, and how the prompt is
 * recorded — plus the stream that answers it.
 *
 * A POST is either a new prompt or the answer to an approval the agent parked.
 * The second kind is not a new prompt: it continues the row that is waiting, so
 * approving an action does not consume another prompt from the allowance.
 *
 * The route above this owns only the session and the request body; everything
 * that reads the conversation lives here, which is what keeps the endpoint thin
 * and lets a second surface (a workspace conversation) reuse the same turn.
 */

const STREAM_ERROR = "The agent could not finish that prompt. Try again in a moment.";
// The reason is included because the messages name the setting to fix, and a
// generic "not configured" sends the operator looking at AI_MODEL even when the
// real problem is the approval secret. They never contain a secret value.
const notConfigured = (reason: string) => `The agent is not configured yet. ${reason}`;
const BUSY =
  "The agent is still working on your previous prompt. Stop it or wait for it to finish.";
const APPROVAL_EXPIRED = "That approval is no longer waiting. Send a new prompt to try again.";

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status });
}

function isUIMessage(value: unknown): value is UIMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    Array.isArray(message.parts)
  );
}

function readMessages(payload: unknown): UIMessage[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return messages.every(isUIMessage) ? messages : null;
}

/** The view the browser says the person is on; an invalid one is ignored. */
function readUiContext(payload: unknown): UiContext | null {
  if (typeof payload !== "object" || payload === null) return null;
  const parsed = uiContextSchema.safeParse((payload as { uiContext?: unknown }).uiContext);

  return parsed.success ? parsed.data : null;
}

export async function runDashboardTurn({
  payload,
  account,
  signal,
}: {
  payload: unknown;
  account: SessionAccountContext;
  signal: AbortSignal;
}): Promise<Response> {
  const messages = readMessages(payload);
  if (!messages) {
    return jsonError("Send at least one prompt to the agent.", 400);
  }

  const kind = promptRequestKind(messages);
  const newest = messages[messages.length - 1];

  if (kind === "new") {
    const prompt = lastUserText(messages);
    const problem = promptProblem(prompt ?? "");
    if (!prompt || problem) {
      return jsonError(problem ?? "Write a prompt first.", 400);
    }
  }

  const reference = kind === "continuation" ? approvalReference(newest) : null;
  if (kind === "continuation" && !reference) {
    return jsonError("Send the approval from the conversation it belongs to.", 400);
  }

  let config;
  try {
    config = getAiConfig();
  } catch (error) {
    if (!(error instanceof AiConfigurationError)) throw error;
    return jsonError(notConfigured(error.message), 503);
  }

  if (config.provider === "stub") {
    // A scripted server left running is otherwise indistinguishable from a real
    // one from the outside: the thread looks answered, and no model request is
    // made. Say so in the log the run is watched in.
    console.warn("[ai] answering with the scripted stub provider; no request is sent to a model");
  }

  const { session, activeTeam } = account;
  const organizationId = activeTeam?.id ?? null;
  const accountName = activeTeam?.name ?? session.user.name;
  const actor = {
    userId: session.user.id,
    organizationId,
    accountName,
  };

  let promptId: string;

  if (kind === "continuation" && reference) {
    const waiting = await findAwaitingApprovalPrompt(session.user.id, reference);
    if (!waiting) {
      return jsonError(APPROVAL_EXPIRED, 409);
    }

    promptId = waiting.promptId;
    await resumePrompt(promptId);
    markThreadStream(session.user.id, promptId);
  } else {
    const entitlements = organizationId
      ? await getOrganizationEntitlements(organizationId)
      : await getUserEntitlements(session.user.id);

    const allowance = await promptAllowance({
      ownerId: organizationId ?? session.user.id,
      userId: session.user.id,
      subscription: entitlements.subscription,
      limits: entitlements.limits,
      accountName,
    });
    if (allowance.message) {
      return jsonError(allowance.message, 402, { limitReached: true });
    }

    const opened = await openDashboardPrompt({
      ownerId: organizationId ?? session.user.id,
      userId: session.user.id,
      provider: config.provider,
      model: config.model,
    });
    if (opened.kind === "busy") {
      return jsonError(BUSY, 409);
    }

    promptId = opened.promptId;
    // Marked before the next await, so a parallel send cannot mistake this
    // QUEUED row for an orphan and retire it out from under the stream.
    markThreadStream(session.user.id, promptId);

    try {
      const submitted = messages[messages.length - 1];
      await appendUserPromptMessage({
        promptId,
        userId: session.user.id,
        parts: submitted.parts,
      });
      await markPromptRunning(promptId);
    } catch (error) {
      console.error("[ai] could not record the prompt:", error);
      clearThreadStream(session.user.id, promptId);
      await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
      return jsonError(STREAM_ERROR, 500);
    }
  }

  // Without a secret an approval response could be forged by the browser, so
  // the gated tools are not offered at all rather than offered unprotected.
  const allowApprovalTools = Boolean(config.toolApprovalSecret);

  let failed = false;
  let usageFromStream: unknown = null;

  try {
    return await createAgentUIStreamResponse({
      agent: createAgent({
        tools: createWorkspaceTools(actor, { promptId, allowApprovalTools }),
        instructions: buildInstructions(DEFAULT_AGENT_INSTRUCTIONS, readUiContext(payload)),
        toolsRequiringApproval: allowApprovalTools ? approvalGatedCapabilityNames : undefined,
        toolApprovalSecret: config.toolApprovalSecret,
      }),
      uiMessages: messages,
      originalMessages: messages,
      generateMessageId: generateId,
      abortSignal: signal,
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
        try {
          if (responseMessage.parts.length > 0) {
            await appendAssistantPromptMessage({
              promptId,
              parts: responseMessage.parts,
            });
          }

          const status = promptStatusAfterStream({
            isAborted,
            isCancelled,
            failed: failed || outcome.status === "failed",
            awaitingApproval: hasPendingApproval(responseMessage),
          });

          if (kind === "continuation") {
            // The prompt already counted; only its cost grows.
            if (usageFromStream !== null) {
              await accruePromptUsage(promptId, usageFromStream);
            }
            await closePrompt({
              promptId,
              status,
              error: failed ? STREAM_ERROR : null,
            });
            return;
          }

          await closePrompt({
            promptId,
            status,
            usage: usageFromStream,
            error: failed ? STREAM_ERROR : null,
          });
        } catch (error) {
          // The row may keep its RUNNING status if this write failed; releasing
          // the stream is what lets the next send retire it.
          console.error("[ai] could not persist the prompt result:", error);
        } finally {
          clearThreadStream(session.user.id, promptId);
        }
      },
    });
  } catch (error) {
    console.error("[ai] could not start the prompt stream:", error);
    clearThreadStream(session.user.id, promptId);
    await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
    return jsonError(STREAM_ERROR, 500);
  }
}
