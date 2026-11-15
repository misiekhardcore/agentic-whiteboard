"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { pendingSpeech, READ_ALOUD_LANGUAGE, speechErrorMessage } from "@/lib/ai/thread/read-aloud";

/** Support is a fact about the browser, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {
  // The API cannot appear or disappear while the page is open.
};

function browserSupportsSynthesis(): boolean {
  return "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

/** A reply's prose, without its tool calls or the model's reasoning. */
function replyText(message: UIMessage): string {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n");
}

function lastReply(messages: UIMessage[]): UIMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") return message;
  }

  return undefined;
}

export type ReadAloud = {
  /** False where the browser has no speech synthesis. */
  supported: boolean;
  /** The synthesizer is reading, or has utterances waiting behind the current one. */
  isSpeaking: boolean;
  /** Why the browser refused an utterance, or `null`. */
  error: string | null;
  /** Stops the queue and treats the reply as read, so Stop is final. */
  cancel: () => void;
};

/**
 * Reads new agent replies aloud with the browser's speech synthesizer.
 *
 * The reply streams in, so the hook keeps a per-message offset of the text that
 * has been handed over and asks `pendingSpeech` for the sentences that are now
 * complete. Nothing is spoken twice, a phrase still in flight is held back, and
 * the browser's own queue preserves the order.
 *
 * History is not read: every message present at mount is marked as already
 * spoken, so a reload replays the thread silently and only the next reply is
 * voiced. While the preference is off the offsets keep advancing, so turning it
 * on mid-reply starts at the next complete sentence instead of rereading the
 * top. Tool calls, reasoning and the person's own prompts are never spoken.
 *
 * The API is absent on the server, so support is read through
 * `useSyncExternalStore` and everything below runs in effects, never at module
 * scope.
 */
export function useReadAloud({
  messages,
  isBusy,
  enabled,
}: {
  messages: UIMessage[];
  /** The agent is still answering, so a trailing sentence is incomplete. */
  isBusy: boolean;
  /** The stored preference. */
  enabled: boolean;
}): ReadAloud {
  const supported = useSyncExternalStore(subscribeToNothing, browserSupportsSynthesis, () => false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offsets are in a ref because stream chunks arrive outside React's events and
  // each one must advance exactly once.
  const spokenRef = useRef(new Map<string, number>());
  const seededRef = useRef(false);
  const queuedRef = useRef(0);
  // `cancel` is called from handlers that may hold an old closure, so it reads
  // the last committed thread rather than the render it was created in.
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!supported) return;

    // What the page loaded with is history, not a reply to read.
    if (!seededRef.current) {
      seededRef.current = true;
      for (const message of messages) {
        if (message.role === "assistant") {
          spokenRef.current.set(message.id, replyText(message).length);
        }
      }
      return;
    }

    const reply = lastReply(messages);
    if (!reply) return;

    const text = replyText(reply);
    const spoken = spokenRef.current.get(reply.id) ?? 0;

    if (!enabled) {
      // Nothing is read while the preference is off, so text arriving then is
      // skipped when it is switched back on.
      spokenRef.current.set(reply.id, text.length);
      return;
    }

    const pending = pendingSpeech(text, spoken, !isBusy);
    spokenRef.current.set(reply.id, pending.spoken);

    for (const sentence of pending.utterances) {
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = READ_ALOUD_LANGUAGE;
      queuedRef.current += 1;

      utterance.onstart = () => {
        setError(null);
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        queuedRef.current = Math.max(queuedRef.current - 1, 0);
        if (queuedRef.current === 0) setIsSpeaking(false);
      };
      utterance.onerror = (event) => {
        queuedRef.current = Math.max(queuedRef.current - 1, 0);
        setError(speechErrorMessage(event.error));
        if (queuedRef.current === 0) setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [enabled, isBusy, messages, supported]);

  // Speech outlives a component unless it is stopped; navigating away from the
  // composer must not leave a voice reading a thread that is no longer on screen.
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function cancel() {
    const reply = lastReply(messagesRef.current);
    // A stopped reply must not be spoken by the final flush that follows.
    if (reply) spokenRef.current.set(reply.id, replyText(reply).length);

    queuedRef.current = 0;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    // A failure that made the person stop is no longer news once it is off.
    setError(null);
  }

  return { supported, isSpeaking, error, cancel };
}
