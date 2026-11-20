"use client";

import type { KeyboardEvent, SubmitEvent } from "react";
import { useState } from "react";

import {
  applyComposerIntent,
  type ComposerField,
  composerKeyIntent,
  submittedPrompt,
} from "@/lib/ai/thread/composer";
import { threadText } from "@/lib/ai/thread/parts";
import { lastUserMessage } from "@/lib/ai/thread/rules";

import type { AgentSession } from "./useAgentSession";
import type { useDraftField } from "./useDraftField";

/**
 * Sending the prompt field's words: Enter submits, a send replaces an edited
 * prompt's turn, and a retry re-sends the last prompt without spending another.
 */
export function usePromptSend({
  session,
  field,
  fieldValue,
  composerField,
  initialCanRetry,
}: {
  session: AgentSession;
  field: ReturnType<typeof useDraftField>;
  /** The textarea's current text, which is the live transcript while dictating. */
  fieldValue: string;
  /** What an intent does to the field, dictation included. */
  composerField: ComposerField;
  /** The newest stored prompt failed, so it can be retried for free. */
  initialCanRetry: boolean;
}) {
  const [canRetry, setCanRetry] = useState(initialCanRetry);
  const promptToSend = submittedPrompt(fieldValue);

  function retryLastPrompt() {
    const last = lastUserMessage(session.messages);
    const text = last ? threadText(last).trim() : "";
    if (!last || !text || session.isBusy) return;

    session.clearFailure();
    setCanRetry(false);
    session.clearError();
    void session.sendMessage({ text, messageId: last.id });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    // The words read so far are kept and the session is closed: nothing is left
    // listening behind the reply.
    applyComposerIntent({ intent: "send" }, composerField);
    if (!promptToSend) return;

    const editId = field.editing?.messageId ?? null;

    session.clearFailure();
    setCanRetry(false);
    field.clearEditing();
    session.clearError();
    // A rewind replaces the edited message and drops the turns after it; an
    // ordinary send appends. While the agent is busy `useChat` queues it and
    // sends it as the thread's next prompt, so a prompt typed mid-reply is
    // neither dropped nor refused.
    void session.sendMessage(
      editId ? { text: promptToSend, messageId: editId } : { text: promptToSend },
    );
    field.setDraft("");
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

  return {
    canRetry,
    promptToSend,
    retryLastPrompt,
    handleSubmit,
    handleKeyDown,
    resetRetry: () => setCanRetry(false),
  };
}
