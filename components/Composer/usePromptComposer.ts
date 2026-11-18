"use client";

import type { UIMessage } from "ai";
import type { RefObject } from "react";
import { useState } from "react";

import { composerHint } from "@/lib/ai/thread/composer";
import { threadText } from "@/lib/ai/thread/parts";
import type { DashboardConversation } from "@/lib/ai/thread/rules";

import { useAgentSession } from "./useAgentSession";
import { useComposerVoice } from "./useComposerVoice";
import { useConversationNavigation } from "./useConversationNavigation";
import { useConversationTitles } from "./useConversationTitles";
import { useDraftField } from "./useDraftField";
import { usePromptSend } from "./usePromptSend";

export type PromptComposerInput = {
  /** The textarea the words and the focus go into. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  /** The conversation this composer sends into; its id is chosen before it exists. */
  initialConversationId: string;
  /** The person's stored thread for that conversation. */
  initialMessages: UIMessage[];
  /** The newest stored prompt failed, so it can be retried for free. */
  initialCanRetry: boolean;
  /** The server's recent conversations, whose titles may still be arriving. */
  initialConversations: DashboardConversation[];
  /** The person's stored read-aloud preference. */
  initialReadAloud: boolean;
  /** The stored browser voice, or "" for the platform's own default. */
  initialReadAloudVoice: string;
};

/**
 * The dashboard's agent session: a prompt box that sends on Enter, keeps
 * Shift+Enter for line breaks and holds one prompt in flight at a time.
 *
 * Each concern has its own hook — the agent session, the draft field, voice,
 * sending and conversation navigation — and this shell only wires them
 * together and names what the composer shows.
 */
export function usePromptComposer({
  fieldRef,
  initialConversationId,
  initialMessages,
  initialCanRetry,
  initialConversations,
  initialReadAloud,
  initialReadAloudVoice,
}: PromptComposerInput) {
  // The id is fixed for this mount: a server refresh re-renders the page with a
  // new id when no conversation exists yet, and adopting it would abandon the
  // conversation the browser is already sending into.
  const [conversationId] = useState(initialConversationId);
  const field = useDraftField({ fieldRef });
  const titles = useConversationTitles({ conversationId, initialConversations });
  const session = useAgentSession({ conversationId, initialMessages });
  const voice = useComposerVoice({
    draft: field.draft,
    setDraft: field.setDraft,
    fieldRef,
    messages: session.messages,
    isBusy: session.isBusy,
    initialReadAloud,
    initialReadAloudVoice,
  });
  // Every path that changes the field or leaves the conversation closes a live
  // dictation session first, so it cannot commit over the change.
  function closeDictation() {
    if (voice.dictation.isListening) voice.dictation.discard();
  }

  const send = usePromptSend({
    session,
    field,
    fieldValue: voice.fieldValue,
    closeDictation,
    initialCanRetry,
    onPromptSent: titles.refresh,
  });
  const navigation = useConversationNavigation({
    conversationId,
    session,
    field,
    closeDictation,
    speech: voice.speech,
    resetRetry: send.resetRetry,
  });

  const { messages, isBusy } = session;
  const lastMessage = messages[messages.length - 1];
  const awaitingText = isBusy && (!lastMessage || threadText(lastMessage).trim().length === 0);
  const hint = composerHint({
    dictationError: voice.dictation.error,
    isListening: voice.dictation.isListening,
    speechError: voice.speech.error,
    dictationSupported: voice.dictation.supported,
    isBusy,
  });

  function editPrompt(message: UIMessage) {
    if (isBusy) return;
    closeDictation();
    field.beginEditing(message);
  }

  function applyExample(prompt: string) {
    // An example replaces the draft, so an open session must not commit over it.
    closeDictation();
    field.apply(prompt);
  }

  return {
    conversationId,
    conversations: titles.conversations,
    messages,
    status: session.status,
    stop: session.stop,
    addToolApprovalResponse: session.addToolApprovalResponse,
    queuedMessages: session.queuedMessages,
    experimental_removeQueuedMessage: session.removeQueuedMessage,
    isBusy,
    awaitingText,
    fieldValue: voice.fieldValue,
    promptToSend: send.promptToSend,
    draft: field.draft,
    setDraft: field.setDraft,
    failure: session.failure,
    editing: field.editing,
    branching: navigation.branching,
    canRetry: send.canRetry,
    readAloud: voice.readAloud,
    dictation: voice.dictation,
    speech: voice.speech,
    hint,
    retryLastPrompt: send.retryLastPrompt,
    handleSubmit: send.handleSubmit,
    handleKeyDown: send.handleKeyDown,
    editPrompt,
    cancelEdit: field.cancelEditing,
    branchFrom: navigation.branchFrom,
    startNewConversation: navigation.startNewConversation,
    toggleReadAloud: voice.toggleReadAloud,
    applyExample,
  };
}
