import { createAgentUIStreamResponse, generateId, type UIMessage } from "ai";

import { AiConfigurationError, getAiConfig } from "@/lib/ai/providers/config";
import { createAgent } from "@/lib/ai/runtime/agent";
import { buildInstructions, DEFAULT_AGENT_INSTRUCTIONS } from "@/lib/ai/runtime/instructions";
import { createWorkspaceTools } from "@/lib/ai/tools";
import { getOrganizationEntitlements, getUserEntitlements } from "@/lib/billing/entitlements";
import { approvalGatedCapabilityNames } from "@/lib/capabilities/registry";
import type { SessionAccountContext } from "@/lib/identity/account";

import { promptAllowance } from "../allowance";
import { findAwaitingApprovalPrompt } from "../approvals";
import { loadPromptHistory } from "../conversations";
import { clearThreadStream, markThreadStream } from "../live";
import { appendAssistantPromptMessage, findUserPromptTarget } from "../messages";
import {
  accruePromptUsage,
  closePrompt,
  openDashboardPrompt,
  resumePrompt,
  retryFailedPrompt,
} from "../prompts";
import {
  applyApprovalAnswer,
  approvalReference,
  hasPendingApproval,
  lastUserText,
  promptIntent,
  promptProblem,
  promptRequestKind,
  promptStatusAfterStream,
} from "../rules";

import {
  APPROVAL_EXPIRED,
  APPROVAL_MISMATCH,
  BUSY,
  CONVERSATION_MISSING,
  jsonError,
  notConfigured,
  readConversationId,
  readMessages,
  readUiContext,
  recordTurn,
  RETRY_EXPIRED,
  STREAM_ERROR,
} from "./internals";

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

  const conversation = readConversationId(payload);
  if ("error" in conversation) {
    return jsonError(conversation.error, 400);
  }
  const conversationId = conversation.id;

  const kind = promptRequestKind(messages);
  const newest = messages[messages.length - 1];

  if (kind === "new" && newest.role !== "user") {
    return jsonError("Send a prompt to the agent.", 400);
  }

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

  /** A retry and an approval answer reuse their prompt, so its usage accrues. */
  let continuing = kind === "continuation";
  let promptId: string;
  /** The turn's history, read back from the database rather than from the body. */
  let history: UIMessage[];

  if (kind === "continuation" && reference) {
    const waiting = await findAwaitingApprovalPrompt(session.user.id, reference);
    if (!waiting) {
      return jsonError(APPROVAL_EXPIRED, 409);
    }

    promptId = waiting.promptId;
    // Answered before the prompt is resumed, so a body that does not answer the
    // stored question leaves the parked turn exactly as it was.
    const stored = await loadPromptHistory({ promptId, userId: session.user.id });
    const answered = applyApprovalAnswer({ history: stored, answer: newest, reference });
    if (!answered) {
      return jsonError(APPROVAL_MISMATCH, 400);
    }
    history = answered;

    const unParked = await resumePrompt(promptId);
    if (unParked === "busy") {
      return jsonError(BUSY, 409);
    }
    markThreadStream(session.user.id, promptId);
  } else {
    const submitted = messages[messages.length - 1];
    const prompt = lastUserText(messages) ?? "";

    // The newest user message may repeat one the conversation already stored:
    // editing a turn and retrying a failed one both send it again. The stored
    // prompt says which of the two this is.
    const target = await findUserPromptTarget({
      conversationId,
      messageId: submitted.id,
      userId: session.user.id,
    });
    const intent = promptIntent({ text: prompt, target });

    if (intent.kind === "retry") {
      const resumed = await retryFailedPrompt({
        conversationId,
        promptId: intent.promptId,
        userId: session.user.id,
      });
      if (resumed === "busy") {
        return jsonError(BUSY, 409);
      }
      if (resumed === "expired") {
        return jsonError(RETRY_EXPIRED, 409);
      }
      promptId = intent.promptId;
      continuing = true;
      markThreadStream(session.user.id, promptId);

      // A retry re-runs a stored prompt: there is no message to write, but the
      // turn is replayed the same way an appended one is.
      const replayed = await recordTurn({ promptId, userId: session.user.id });
      if ("error" in replayed) return replayed.error;
      history = replayed.history;
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
        conversationId,
        ownerId: organizationId ?? session.user.id,
        userId: session.user.id,
        provider: config.provider,
        model: config.model,
        discardFrom:
          intent.kind === "rewind" && target
            ? { id: intent.fromPromptId, createdAt: target.createdAt }
            : undefined,
      });
      if (opened.kind === "busy") {
        return jsonError(BUSY, 409);
      }
      if (opened.kind === "missing") {
        return jsonError(CONVERSATION_MISSING, 404);
      }

      promptId = opened.promptId;
      // Marked before the next await, so a parallel send cannot mistake this
      // QUEUED row for an orphan and retire it out from under the stream.
      markThreadStream(session.user.id, promptId);

      const recorded = await recordTurn({
        promptId,
        userId: session.user.id,
        submitted,
        // A rewind replaces a stored message whose id the browser still holds,
        // so the new row needs its own id; an append keeps the browser's, which
        // is what makes the just-sent prompt editable.
        keepMessageId: intent.kind === "append",
      });
      if ("error" in recorded) return recorded.error;
      history = recorded.history;
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
      uiMessages: history,
      originalMessages: history,
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

          if (continuing) {
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
