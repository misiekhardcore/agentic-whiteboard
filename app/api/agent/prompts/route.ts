import {
  createAgentUIStreamResponse,
  generateId,
  type UIMessage,
} from "ai";

import { getSessionAccount } from "@/lib/account";
import { createAgent } from "@/lib/ai/agent";
import { AiConfigurationError, getAiConfig } from "@/lib/ai/config";
import {
  appendAssistantPromptMessage,
  appendUserPromptMessage,
  closePrompt,
  markPromptRunning,
  openDashboardPrompt,
} from "@/lib/ai/prompts";
import {
  lastUserText,
  promptProblem,
  promptStatusAfterStream,
} from "@/lib/ai/prompt-thread";
import { createWorkspaceTools } from "@/lib/ai/tools";
import {
  getOrganizationEntitlements,
  getUserEntitlements,
} from "@/lib/billing/entitlements";
import { getAccountUsage, promptLimitMessage } from "@/lib/billing/usage";

/**
 * The dashboard prompt thread. One POST carries the whole conversation; only
 * the last user message is new. The route owns everything the client must not
 * decide: who is asking, which account pays, whether the allowance has room,
 * and how the prompt is recorded.
 */

const STREAM_ERROR =
  "The agent could not finish that prompt. Try again in a moment.";
const NOT_CONFIGURED =
  "The agent is not configured yet. Set AI_MODEL for your provider and try again.";
const BUSY =
  "The agent is still working on your previous prompt. Stop it or wait for it to finish.";

function jsonError(
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error, ...extra }, { status });
}

function isUIMessage(value: unknown): value is UIMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" ||
      message.role === "assistant" ||
      message.role === "system") &&
    Array.isArray(message.parts)
  );
}

function readMessages(payload: unknown): UIMessage[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return messages.every(isUIMessage) ? messages : null;
}

export async function POST(request: Request): Promise<Response> {
  const account = await getSessionAccount();
  if (!account) {
    return jsonError("Sign in to send a prompt.", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Send the conversation as JSON.", 400);
  }

  const messages = readMessages(payload);
  if (!messages) {
    return jsonError("Send at least one prompt to the agent.", 400);
  }

  const prompt = lastUserText(messages);
  const problem = promptProblem(prompt ?? "");
  if (!prompt || problem) {
    return jsonError(problem ?? "Write a prompt first.", 400);
  }

  let config;
  try {
    config = getAiConfig();
  } catch (error) {
    if (!(error instanceof AiConfigurationError)) throw error;
    return jsonError(NOT_CONFIGURED, 503);
  }

  const { session, activeTeam } = account;
  const organizationId = activeTeam?.id ?? null;
  const accountName = activeTeam?.name ?? session.user.name;

  const entitlements = organizationId
    ? await getOrganizationEntitlements(organizationId)
    : await getUserEntitlements(session.user.id);

  const usage = await getAccountUsage({
    userId: session.user.id,
    organizationId,
    subscription: entitlements.subscription,
    limits: entitlements.limits,
  });

  const limitMessage = promptLimitMessage({
    used: usage.agentPrompts.used,
    limit: usage.agentPrompts.limit,
    accountName,
    periodLabel: usage.agentPrompts.periodLabel,
  });
  if (limitMessage) {
    return jsonError(limitMessage, 402, { limitReached: true });
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

  const { promptId } = opened;

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
    await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
    return jsonError(STREAM_ERROR, 500);
  }

  let failed = false;
  let usageFromStream: unknown = null;

  try {
    return await createAgentUIStreamResponse({
      agent: createAgent({
        tools: createWorkspaceTools({
          userId: session.user.id,
          organizationId,
          accountName,
        }),
      }),
      uiMessages: messages,
      originalMessages: messages,
      generateMessageId: generateId,
      abortSignal: request.signal,
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
      onEnd: async ({
        responseMessage,
        isAborted,
        isCancelled,
        outcome,
      }) => {
        try {
          if (responseMessage.parts.length > 0) {
            await appendAssistantPromptMessage({
              promptId,
              parts: responseMessage.parts,
            });
          }

          await closePrompt({
            promptId,
            status: promptStatusAfterStream({
              isAborted,
              isCancelled,
              failed: failed || outcome.status === "failed",
            }),
            usage: usageFromStream,
            error: failed ? STREAM_ERROR : null,
          });
        } catch (error) {
          // The stream is already closed; the prompt row keeps its RUNNING
          // status and the next send retires it as stale.
          console.error("[ai] could not persist the prompt result:", error);
        }
      },
    });
  } catch (error) {
    console.error("[ai] could not start the prompt stream:", error);
    await closePrompt({ promptId, status: "FAILED", error: STREAM_ERROR });
    return jsonError(STREAM_ERROR, 500);
  }
}
