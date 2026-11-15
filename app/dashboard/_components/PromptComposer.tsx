"use client";

import { useChat } from "@ai-sdk/react";
import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Textarea } from "@konopskidev/ui/components/textarea";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { ArrowUp, Square, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  composerKeyIntent,
  composerView,
  EXAMPLE_PROMPTS,
  submittedPrompt,
} from "@/lib/ai/prompt-composer";
import { threadText } from "@/lib/ai/thread-parts";
import { routes } from "@/lib/routes";

import { PromptThread } from "./PromptThread";

type PromptFailure = {
  message: string;
  limitReached: boolean;
};

/**
 * The API answers refusals with `{ error, limitReached? }`, and the transport
 * throws that body verbatim as the error message.
 */
function promptFailure(error: Error): PromptFailure {
  try {
    const parsed = JSON.parse(error.message) as {
      error?: unknown;
      limitReached?: unknown;
    };
    if (typeof parsed.error === "string") {
      return {
        message: parsed.error,
        limitReached: parsed.limitReached === true,
      };
    }
  } catch {
    // Not a JSON body: fall through to the generic message.
  }

  return {
    message: "The agent could not answer that prompt. Try again.",
    limitReached: false,
  };
}

type PromptComposerProps = {
  /** The person's dashboard thread, loaded on the server. */
  initialMessages: UIMessage[];
};

/**
 * The dashboard's starting point for an agent session: a prompt box that sends
 * on Enter, keeps Shift+Enter for line breaks, and offers curated examples that
 * fill the field so they stay editable before sending. Replies stream in above
 * the box, and the thread survives a reload because the route stores it.
 *
 * Only one prompt runs at a time, so a prompt sent while the agent is answering
 * waits in `useChat`'s queue and goes out when the current turn ends.
 */
export function PromptComposer({ initialMessages }: PromptComposerProps) {
  const [draft, setDraft] = useState("");
  const [failure, setFailure] = useState<PromptFailure | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: routes.agentPromptsApi,
        // Read at send time, so "this workspace" keeps working after a
        // navigation; the server treats it as a hint and validates it.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            uiContext: composerView(window.location.pathname),
          },
        }),
      }),
    [],
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
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const promptToSend = submittedPrompt(draft);
  // A reasoning model streams reasoning parts before any visible text, so the
  // thread would look empty even though the agent is working.
  const lastMessage = messages[messages.length - 1];
  const awaitingText = isBusy && (!lastMessage || threadText(lastMessage).trim().length === 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promptToSend) return;

    setFailure(null);
    clearError();
    // While the agent is busy `useChat` queues this and sends it as the thread's
    // next prompt, so a prompt typed mid-reply is neither dropped nor refused.
    void sendMessage({ text: promptToSend });
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const intent = composerKeyIntent({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    });

    // A bare Enter sends through the form so the button and the keyboard share
    // one path; every other key keeps the textarea's native behaviour.
    if (intent !== "submit") return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function applyExample(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  return (
    <section aria-labelledby="prompt-composer-title" className="topo-bg px-2 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 id="prompt-composer-title" className="page-title text-balance sm:text-display">
            What are we planning today?
          </h1>
          <p className="text-lead text-pretty text-muted-foreground">
            Describe it, and the agent drafts the doc and the canvas for you.
          </p>
        </div>

        <PromptThread
          messages={messages}
          isDrafting={awaitingText}
          onApproval={(approvalId, approved) => {
            addToolApprovalResponse({ id: approvalId, approved });
          }}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {queuedMessages.length > 0 && (
            <ul aria-label="Queued prompts" className="flex flex-col gap-2">
              {queuedMessages.map((message) => (
                <li
                  key={message.id}
                  className="ml-auto flex max-w-[85%] items-start gap-2 rounded-2xl border border-dashed px-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="whitespace-pre-wrap">{threadText(message).trim()}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove queued prompt"
                    onClick={() => experimental_removeQueuedMessage(message.id)}
                  >
                    <X />
                  </Button>
                </li>
              ))}
              <li className="ml-auto text-xs text-muted-foreground">
                Queued: the agent takes them one at a time.
              </li>
            </ul>
          )}

          <div className="flex flex-col card p-1.5">
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Prompt"
              aria-describedby="prompt-composer-hint"
              placeholder="e.g. Design the database for a food delivery app and document it"
              className="min-h-28 resize-none border-0 bg-transparent px-2.5 py-2"
            />

            <div className="flex items-center justify-between gap-3 px-1.5">
              <p id="prompt-composer-hint" className="text-xs text-muted-foreground">
                {isBusy
                  ? "Shift + Enter for a new line · Enter queues this prompt for the next turn"
                  : "Shift + Enter for a new line"}
              </p>
              <div className="flex items-center gap-2">
                {isBusy && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="rounded-full shadow"
                    aria-label="Stop prompt"
                    onClick={() => void stop()}
                  >
                    <Square />
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="icon-lg"
                  className="rounded-full shadow"
                  aria-label={isBusy ? "Queue prompt" : "Send prompt"}
                  disabled={!promptToSend}
                >
                  <ArrowUp />
                </Button>
              </div>
            </div>
          </div>

          {failure && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{failure.message}</span>
                {failure.limitReached && (
                  <Link
                    href={routes.dashboardBilling}
                    className="font-medium underline underline-offset-4"
                  >
                    View plans
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}

          <ul aria-label="Example prompts" className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto rounded-full py-1.5 text-left"
                  onClick={() => applyExample(prompt)}
                >
                  {prompt}
                </Button>
              </li>
            ))}
          </ul>
        </form>
      </div>
    </section>
  );
}
