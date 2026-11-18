"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { composerView } from "@/lib/ai/thread/composer";
import { promptFailure } from "@/lib/ai/thread/transport/promptFailure";
import { routes } from "@/lib/shared/routes";

type PromptFailure = ReturnType<typeof promptFailure>;

/**
 * The agent session behind one composer: the transport that talks to the
 * prompt route, the single in-flight turn, its queue, the approval answers, and
 * the last failure the person should see.
 */
export function useAgentSession({
  conversationId,
  initialMessages,
  onTurnFinished,
}: {
  /** The conversation this composer sends into; its id is chosen before it exists. */
  conversationId: string;
  /** The person's stored thread for that conversation. */
  initialMessages: UIMessage[];
  /** Runs when a turn ends, for work the turn scheduled for after its response. */
  onTurnFinished?: () => void;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<PromptFailure | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: routes.agentPromptsApi,
        // Read at send time, so "this workspace" keeps working after a
        // navigation; the server treats it as a hint and validates it.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            conversationId,
            uiContext: composerView(window.location.pathname),
          },
        }),
      }),
    [conversationId],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    clearError,
    addToolApprovalResponse,
    experimental_queuedMessages: queuedMessages = [],
    experimental_removeQueuedMessage,
  } = useChat({
    messages: initialMessages,
    transport,
    // The thread runs one prompt at a time, so a prompt sent while the agent is
    // still answering — or is parked on an approval — waits in this queue and
    // goes out when the current turn ends. Stopping or a failed turn pauses it
    // rather than replaying the queue against a thread that is not ready.
    experimental_queue: true,
    // Answering an approval is not a new prompt: once every outstanding
    // decision is answered, the thread resumes the run that was parked.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onToolCall: ({ toolCall }) => {
      // The browser performs this one: the agent asked for a workspace to be
      // opened, and the person lands on it.
      if (toolCall.toolName !== "openWorkspace") return;
      const input = toolCall.input as { workspaceId?: unknown } | undefined;
      if (typeof input?.workspaceId === "string") {
        router.push(routes.workspace(input.workspaceId));
      }
    },
    onError: (error) => {
      const next = promptFailure(error);
      setFailure(next);
      toast.error(next.message);
    },
    onFinish: () => {
      // A tool may have created a workspace; the latest list is server-rendered.
      router.refresh();
      // The title request was scheduled for after this response; watch for it so
      // the pill swaps without another navigation.
      onTurnFinished?.();
    },
  });

  return {
    messages,
    sendMessage,
    status,
    isBusy: status === "submitted" || status === "streaming",
    stop,
    clearError,
    addToolApprovalResponse,
    queuedMessages,
    removeQueuedMessage: experimental_removeQueuedMessage,
    failure,
    clearFailure: () => setFailure(null),
  };
}

export type AgentSession = ReturnType<typeof useAgentSession>;
