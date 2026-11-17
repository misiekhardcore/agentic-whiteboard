"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, RefObject, SubmitEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useDictation } from "@/components/Voice/useDictation";
import { useReadAloud } from "@/components/Voice/useReadAloud";
import { branchConversationAction } from "@/lib/ai/actions";
import { composerKeyIntent, composerView, submittedPrompt } from "@/lib/ai/thread/composer";
import { threadText } from "@/lib/ai/thread/parts";
import { lastUserMessage } from "@/lib/ai/thread/rules";
import { promptFailure } from "@/lib/ai/thread/transport/promptFailure";
import { setReadAloudAction } from "@/lib/identity/actions";
import { routes } from "@/lib/shared/routes";

type PromptFailure = ReturnType<typeof promptFailure>;

export type PromptComposerInput = {
  /** The textarea the words and the focus go into. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  /** The conversation this composer sends into; its id is chosen before it exists. */
  initialConversationId: string;
  /** The person's stored thread for that conversation. */
  initialMessages: UIMessage[];
  /** The newest stored prompt failed, so it can be retried for free. */
  initialCanRetry: boolean;
  /** The person's stored read-aloud preference. */
  initialReadAloud: boolean;
  /** The stored browser voice, or "" for the platform's own default. */
  initialReadAloudVoice: string;
};

/**
 * The dashboard's agent session: a prompt box that sends on Enter, keeps
 * Shift+Enter for line breaks, and keeps one prompt in flight at a time.
 * Editing a past prompt sends it again with its own message id, which tells the
 * route to replace that turn and everything after it. Retrying re-sends the
 * last prompt's message, and a failed prompt's retry reuses its row instead of
 * consuming another.
 */
export function usePromptComposer({
  fieldRef: textareaRef,
  initialConversationId,
  initialMessages,
  initialCanRetry,
  initialReadAloud,
  initialReadAloudVoice,
}: PromptComposerInput) {
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
  const lastMessage = messages[messages.length - 1];
  const awaitingText = isBusy && (!lastMessage || threadText(lastMessage).trim().length === 0);
  const speech = useReadAloud({
    messages,
    isBusy,
    enabled: readAloud,
    voiceName: initialReadAloudVoice,
  });

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

  return {
    conversationId,
    messages,
    status,
    stop,
    addToolApprovalResponse,
    queuedMessages,
    experimental_removeQueuedMessage,
    isBusy,
    awaitingText,
    fieldValue,
    promptToSend,
    draft,
    setDraft,
    failure,
    editing,
    branching,
    canRetry,
    readAloud,
    dictation,
    speech,
    hint,
    retryLastPrompt,
    handleSubmit,
    handleKeyDown,
    editPrompt,
    cancelEdit,
    branchFrom,
    startNewConversation,
    toggleReadAloud,
    applyExample,
  };
}
