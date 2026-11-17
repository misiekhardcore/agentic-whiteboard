"use client";

import type { UIMessage } from "ai";
import type { RefObject } from "react";
import { useState } from "react";

import { threadText } from "@/lib/ai/thread/parts";

/**
 * The prompt field's own state: what is in the textarea and which past prompt,
 * if any, a send replaces. Guarding against a busy session and closing a live
 * dictation session belong to the caller that knows about those.
 */
export function useDraftField({ fieldRef }: { fieldRef: RefObject<HTMLTextAreaElement | null> }) {
  const [draft, setDraft] = useState("");
  // The message whose turn a send replaces, if the person is editing one.
  const [editing, setEditing] = useState<{ messageId: string } | null>(null);

  function focus() {
    fieldRef.current?.focus();
  }

  /** Put a past prompt in the field and mark it as the one a send replaces. */
  function beginEditing(message: UIMessage) {
    setEditing({ messageId: message.id });
    setDraft(threadText(message).trim());
    focus();
  }

  /** Stop treating the next send as a replacement, leaving the words alone. */
  function clearEditing() {
    setEditing(null);
  }

  /** Leave editing without sending, dropping the words it put in the field. */
  function cancelEditing() {
    setEditing(null);
    setDraft("");
    focus();
  }

  /** Put a prompt in the field without marking an edit, e.g. an example. */
  function apply(prompt: string) {
    setDraft(prompt);
    focus();
  }

  /** Clear the field and the edit, keeping focus where the person is working. */
  function clear() {
    setDraft("");
    setEditing(null);
  }

  return { draft, setDraft, editing, beginEditing, clearEditing, cancelEditing, apply, clear };
}
