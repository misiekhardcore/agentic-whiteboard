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
import { ArrowUp, Plus, RotateCcw, Square, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, SubmitEvent } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { branchConversationAction } from "@/lib/ai/actions";
import {
  composerKeyIntent,
  composerView,
  EXAMPLE_PROMPTS,
  submittedPrompt,
} from "@/lib/ai/thread/composer";
import { threadText } from "@/lib/ai/thread/parts";
import { type DashboardConversation, lastUserMessage } from "@/lib/ai/thread/rules";
import { setReadAloudAction } from "@/lib/identity/actions";
import { routes } from "@/lib/shared/routes";

import { ConversationSwitcher } from "./ConversationSwitcher";
import { DictationButton } from "./DictationButton";
import { PromptThread } from "./PromptThread";
import { ReadAloudButton } from "./ReadAloudButton";
import { useDictation } from "./useDictation";
import { useReadAloud } from "./useReadAloud";

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
  /** The conversation this composer sends into; its id is chosen before it exists. */
  initialConversationId: string;
  /** The person's stored thread for that conversation. */
  initialMessages: UIMessage[];
  /** The newest stored prompt failed, so it can be retried for free. */
  initialCanRetry: boolean;
  /** The person's recent conversations, for the switcher. */
  initialConversations: DashboardConversation[];
  /** The person's stored read-aloud preference. */
  initialReadAloud: boolean;
  /** The stored browser voice, or "" for the platform's own default. */
  initialReadAloudVoice: string;
};

/**
 * The dashboard's starting point for an agent session: a prompt box that sends
 * on Enter, keeps Shift+Enter for line breaks, and offers curated examples that
 * fill the field so they stay editable before sending. Replies stream in above
 * the box, and the thread survives a reload because the route stores it.
 *
 * The conversation is the unit a person moves around in. A new conversation is a
 * URL state with a fresh id, so the thread starts empty and the first prompt
 * creates it; the switcher reopens an earlier one. Editing a past prompt sends it
 * again with its own message id, which tells the route to replace that turn and
 * everything after it. Retrying re-sends the last prompt's message, and a failed
 * prompt's retry reuses its row instead of consuming another.
 *
 * Only one prompt runs at a time, so a prompt sent while the agent is answering
 * waits in `useChat`'s queue and goes out when the current turn ends.
 *
 * The microphone dictates into the draft through `useDictation`: the browser
 * recognizes the speech and the words are spliced in where the caret was, with
 * the phrase still in flight previewed in place, and committed as editable text
 * when the session ends.
 *
 * Read aloud is the reverse: `useReadAloud` speaks new agent replies sentence
 * by sentence as they stream, and both the switch and the voice are the person's
 * stored choices, so they follow them between devices. Each reply also carries
 * its own speaker, so a stored reply can be heard again on demand.
 */
export function PromptComposer({
  initialConversationId,
  initialMessages,
  initialCanRetry,
  initialConversations,
  initialReadAloud,
  initialReadAloudVoice,
}: PromptComposerProps) {
  // The id is fixed for this mount: a server refresh re-renders the page with a
  // new id when no conversation exists yet, and adopting it would abandon the
  // conversation the browser is already sending into.
  const [conversationId] = useState(initialConversationId);
  const [draft, setDraft] = useState("");
  const [failure, setFailure] = useState<PromptFailure | null>(null);
  // The message whose turn a send replaces, if the person is editing one.
  const [editing, setEditing] = useState<{ messageId: string } | null>(null);
  // The reply being copied into a new conversation, while the copy is written.
  const [branching, setBranching] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(initialCanRetry);
  const [readAloud, setReadAloud] = useState(initialReadAloud);
  const [, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const dictation = useDictation({ draft, setDraft, fieldRef: textareaRef });

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
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const fieldValue = dictation.value;
  const promptToSend = submittedPrompt(fieldValue);
  // A reasoning model streams reasoning parts before any visible text, so the
  // thread would look empty even though the agent is working.
  const lastMessage = messages[messages.length - 1];
  const awaitingText = isBusy && (!lastMessage || threadText(lastMessage).trim().length === 0);
  const speech = useReadAloud({
    messages,
    isBusy,
    enabled: readAloud,
    voiceName: initialReadAloudVoice,
  });

  /**
   * Sends the last prompt again. The message id is the one the route needs to
   * recognise a retry: the stored prompt is reused when it failed, so the retry
   * does not cost another prompt.
   */
  function retryLastPrompt() {
    const last = lastUserMessage(messages);
    const text = last ? threadText(last).trim() : "";
    if (!last || !text || isBusy) return;

    setFailure(null);
    setCanRetry(false);
    clearError();
    void sendMessage({ text, messageId: last.id });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    // Sending while dictating keeps the words heard so far and closes the
    // session; nothing is left listening behind the reply.
    if (dictation.isListening) dictation.discard();
    if (!promptToSend) return;

    const editId = editing?.messageId ?? null;

    setFailure(null);
    setCanRetry(false);
    setEditing(null);
    clearError();
    // A rewind replaces the edited message and drops the turns after it; an
    // ordinary send appends. While the agent is busy `useChat` queues it and
    // sends it as the thread's next prompt, so a prompt typed mid-reply is
    // neither dropped nor refused.
    void sendMessage(editId ? { text: promptToSend, messageId: editId } : { text: promptToSend });
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

  function editPrompt(message: UIMessage) {
    if (isBusy) return;
    if (dictation.isListening) dictation.discard();

    setEditing({ messageId: message.id });
    setDraft(threadText(message).trim());
    textareaRef.current?.focus();
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
    textareaRef.current?.focus();
  }

  /**
   * Copies the thread through a reply into a new conversation and opens it. The
   * copy is the server's: the branch keeps what was stored, not what this tab
   * happens to be showing, and the original conversation is untouched.
   */
  function branchFrom(message: UIMessage) {
    if (isBusy || branching) return;
    if (dictation.isListening) dictation.discard();

    setBranching(message.id);
    startTransition(async () => {
      const result = await branchConversationAction({
        conversationId,
        messageId: message.id,
      });

      if (!result.ok) {
        setBranching(null);
        toast.error(result.error);
        return;
      }

      router.push(routes.dashboardConversation(result.conversationId));
    });
  }

  /**
   * Starts an empty thread. The id is made here so the empty conversation is a
   * place the URL can return to, and the first prompt is what creates it.
   */
  function startNewConversation() {
    if (isBusy) return;
    if (dictation.isListening) dictation.discard();
    speech.cancel();

    setDraft("");
    setEditing(null);
    setFailure(null);
    setCanRetry(false);
    router.push(routes.dashboardConversation(crypto.randomUUID()));
  }

  function toggleReadAloud() {
    const next = !readAloud;
    // Flip first, because turning it off must go silent immediately; a failed
    // save puts the button back rather than claiming a choice that was lost.
    setReadAloud(next);
    if (!next) speech.cancel();

    startTransition(async () => {
      const result = await setReadAloudAction(next);
      if (!result.ok) {
        setReadAloud(!next);
        toast.error(result.error);
      }
    });
  }

  function applyExample(prompt: string) {
    // An example replaces the draft, so an open session must not commit over it.
    if (dictation.isListening) dictation.discard();

    setDraft(prompt);
    textareaRef.current?.focus();
  }

  // What the line under the field says, in the order the person needs it: a
  // failure, the live session, a reason the microphone is unavailable, then the
  // keyboard hint.
  const hint = dictation.error
    ? dictation.error
    : dictation.isListening
      ? "Listening… speak your prompt, then press the microphone again"
      : speech.error
        ? speech.error
        : !dictation.supported
          ? "Voice input needs a browser with speech recognition, such as Chrome or Safari"
          : isBusy
            ? "Shift + Enter for a new line · Enter queues this prompt for the next turn"
            : "Shift + Enter for a new line";

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

        {initialConversations.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ConversationSwitcher conversations={initialConversations} currentId={conversationId} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={startNewConversation}
              disabled={isBusy}
            >
              <Plus />
              New conversation
            </Button>
          </div>
        )}

        <PromptThread
          messages={messages}
          isDrafting={awaitingText}
          branchingId={branching}
          onBranch={isBusy ? undefined : branchFrom}
          onEdit={isBusy ? undefined : editPrompt}
          onRegenerate={isBusy ? undefined : retryLastPrompt}
          editingId={editing?.messageId ?? null}
          onRead={speech.supported ? speech.readMessage : undefined}
          onStop={speech.supported ? speech.cancel : undefined}
          speakingId={speech.speakingId}
          // Only the reply still arriving is off limits: reading it now would
          // take over the queue and leave the rest of it unheard.
          streamingId={isBusy ? messages[messages.length - 1]?.id : null}
          onApproval={(approvalId, approved) => {
            addToolApprovalResponse({ id: approvalId, approved });
          }}
        />

        {canRetry && !failure && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              The last prompt did not finish. Retrying it does not use another prompt.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retryLastPrompt}
              disabled={isBusy}
            >
              <RotateCcw />
              Retry
            </Button>
          </div>
        )}

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

          {editing && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted px-3 py-2 text-xs">
              <span>
                Editing an earlier prompt. Sending replaces it and everything the agent answered
                after it.
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          )}

          <div className="flex flex-col card p-1.5">
            <Textarea
              ref={textareaRef}
              value={fieldValue}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              // The words being dictated own the field until the session ends;
              // typed edits would be overwritten by the next recognition event.
              readOnly={dictation.isListening}
              aria-label="Prompt"
              aria-describedby="prompt-composer-hint"
              placeholder="e.g. Design the database for a food delivery app and document it"
              className="min-h-28 resize-none border-0 bg-transparent px-2.5 py-2"
            />

            <div className="flex items-center justify-between gap-3 px-1.5">
              <p
                id="prompt-composer-hint"
                aria-live="polite"
                className="text-xs text-muted-foreground"
              >
                {hint}
              </p>
              <div className="flex items-center gap-2">
                <DictationButton
                  supported={dictation.supported}
                  isListening={dictation.isListening}
                  describedBy="prompt-composer-hint"
                  onToggle={dictation.toggle}
                />
                <ReadAloudButton
                  supported={speech.supported}
                  enabled={readAloud}
                  isSpeaking={speech.isSpeaking}
                  onToggle={toggleReadAloud}
                />
                {isBusy && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="rounded-full shadow"
                    aria-label="Stop prompt"
                    onClick={() => {
                      speech.cancel();
                      void stop();
                    }}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryLastPrompt}
                  disabled={isBusy}
                >
                  <RotateCcw />
                  Retry
                </Button>
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
