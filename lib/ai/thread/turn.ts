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

import { promptAllowance } from "./allowance";
import { findAwaitingApprovalPrompt } from "./approvals";
import { loadPromptHistory } from "./conversations";
import { clearThreadStream, markThreadStream } from "./live";
import {
  appendAssistantPromptMessage,
  appendUserPromptMessage,
  findUserPromptTarget,
} from "./messages";
import {
  accruePromptUsage,
  closePrompt,
  markPromptRunning,
  openDashboardPrompt,
  resumePrompt,
  retryFailedPrompt,
} from "./prompts";
import {
  applyApprovalAnswer,
  approvalReference,
  conversationIdProblem,
  hasPendingApproval,
  lastUserText,
  promptIntent,
  promptProblem,
  promptRequestKind,
  promptStatusAfterStream,
} from "./rules";

/**
 * One dashboard prompt turn: what the client must not decide — who is asking,
 * which account pays, whether the allowance has room, and how the prompt is
 * recorded — plus the stream that answers it.
 *
 * A POST is one of three things: a new prompt appended to a conversation, a
 * rewind that replaces an earlier turn (the person edited the prompt), or a
 * retry of the newest prompt that failed, which reuses its row so the person is
 * not charged twice. The fourth, answering a parked approval, is not a prompt at
 * all: it continues the row that is waiting.
 *
 * The body is only a submission: the prompt being sent, or the answer to the
 * parked approval. What the model is shown comes from the stored turns, so a
 * body that carries a discarded branch or invented history is answered exactly
 * like a clean one.
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
const APPROVAL_MISMATCH =
  "That approval does not match the prompt waiting for it. Reload the dashboard and answer it again.";
const RETRY_EXPIRED = "That prompt is no longer the one to retry. Send it again as a new prompt.";
const CONVERSATION_MISSING =
  "That conversation could not be found. Start a new one."; /** The browser may pick a message id; the database only takes a plain one. */
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

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

/**
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

/** The view the browser says the person is on; an invalid one is ignored. */
function readUiContext(payload: unknown): UiContext | null {
  if (typeof payload !== "object" || payload === null) return null;
  const parsed = uiContextSchema.safeParse((payload as { uiContext?: unknown }).uiContext);

  return parsed.success ? parsed.data : null;
}

/**
 * Records the accepted prompt — its user message, when this send has one — and
 * reads the turn's history back from the conversation. A failure closes the prompt
 * here, so nothing is left looking live to the single-flight rule.
 */
async function recordTurn({
  promptId,
  userId,
  submitted,
  keepMessageId,
}: {
  promptId: string;
  userId: string;
  /** The message to store; absent when a retry re-runs a stored one. */
  submitted?: UIMessage;
  keepMessageId?: boolean;
}): Promise<{ history: UIMessage[] } | { error: Response }> {
  try {
    if (submitted) {
      await appendUserPromptMessage({
        promptId,
        userId,
        parts: submitted.parts,
        messageId:
          keepMessageId && MESSAGE_ID_PATTERN.test(submitted.id) ? submitted.id : undefined,
      });
      await markPromptRunning(promptId);
    }

    // Read back after the prompt is stored: the history then contains the
    // message just written and excludes every turn the send replaced.
    return { history: await loadPromptHistory({ promptId, userId }) };
  } catch (error) {
    console.error("[ai] could not record the prompt:", error);
    clearThreadStream(userId, promptId);
    await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
    return { error: jsonError(STREAM_ERROR, 500) };
  }
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
