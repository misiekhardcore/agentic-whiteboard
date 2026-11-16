"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  chooseSpeechVoice,
  pendingSpeech,
  READ_ALOUD_LANGUAGE,
  speechErrorMessage,
} from "@/lib/ai/thread/read-aloud";

import { useSpeechVoices } from "./useSpeechVoices";

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
  /** The message being read, while one is, so its card can offer Stop. */
  speakingId: string | null;
  /** Why the browser refused an utterance, or `null`. */
  error: string | null;
  /** Stops the queue and treats the reply as read, so Stop is final. */
  cancel: () => void;
  /** Reads a whole reply again from the top, on the person's request. */
  readMessage: (message: UIMessage) => void;
};

/**
 * Reads agent replies aloud with the browser's speech synthesizer: the reply
 * streaming in, or any reply in the thread on request.
 *
 * The reply streams in, so the hook keeps a per-message offset of the text that
 * has been handed over and asks `pendingSpeech` for the sentences that are now
 * complete. Nothing is spoken twice, a phrase still in flight is held back, and
 * the browser's own queue preserves the order.
 *
 * History is not read on its own: every message present at mount is marked as
 * already spoken, so a reload replays the thread silently and only the next
 * reply is voiced. While the preference is off the offsets keep advancing, so
 * turning it on mid-reply starts at the next complete sentence instead of
 * rereading the top. Tool calls, reasoning and the person's own prompts are
 * never spoken.
 *
 * The API is absent on the server, so support is read through
 * `useSyncExternalStore` and everything below runs in effects, never at module
 * scope.
 */
export function useReadAloud({
  messages,
  isBusy,
  enabled,
  voiceName,
}: {
  messages: UIMessage[];
  /** The agent is still answering, so a trailing sentence is incomplete. */
  isBusy: boolean;
  /** The stored preference. */
  enabled: boolean;
  /** The stored voice, or "" for the browser's own default. */
  voiceName: string;
}): ReadAloud {
  const supported = useSyncExternalStore(subscribeToNothing, browserSupportsSynthesis, () => false);
  const voices = useSpeechVoices();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Offsets are in a ref because stream chunks arrive outside React's events and
  // each one must advance exactly once.
  const spokenRef = useRef(new Map<string, number>());
  const seededRef = useRef(false);
  const queuedRef = useRef(0);
  // A cancelled queue still reports `end` and `error` for the utterances it
  // dropped. The generation makes those late events belong to a queue nobody is
  // watching, so they cannot clear the state of the speech that replaced them.
  const generationRef = useRef(0);
  // `cancel` is called from handlers that may hold an old closure, so it reads
  // the last committed thread rather than the render it was created in.
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const speakSentences = useCallback(
    (sentences: string[], id: string) => {
      if (sentences.length === 0) return;

      const generation = generationRef.current;
      const voice = chooseSpeechVoice(voices, READ_ALOUD_LANGUAGE, voiceName);

      for (const sentence of sentences) {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = READ_ALOUD_LANGUAGE;
        // A browser without the stored voice keeps its own default rather than
        // falling silent.
        if (voice) utterance.voice = voice;
        queuedRef.current += 1;

        const current = () => generationRef.current === generation;

        utterance.onstart = () => {
          if (!current()) return;
          setError(null);
          setIsSpeaking(true);
          setSpeakingId(id);
        };
        utterance.onend = () => {
          if (!current()) return;
          queuedRef.current = Math.max(queuedRef.current - 1, 0);
          if (queuedRef.current === 0) {
            setIsSpeaking(false);
            setSpeakingId(null);
          }
        };
        utterance.onerror = (event) => {
          if (!current()) return;
          queuedRef.current = Math.max(queuedRef.current - 1, 0);
          setError(speechErrorMessage(event.error));
          if (queuedRef.current === 0) {
            setIsSpeaking(false);
            setSpeakingId(null);
          }
        };

        window.speechSynthesis.speak(utterance);
      }
    },
    [voices, voiceName],
  );

  const cancel = useCallback(() => {
    const reply = lastReply(messagesRef.current);
    // A stopped reply must not be spoken by the final flush that follows.
    if (reply) spokenRef.current.set(reply.id, replyText(reply).length);

    generationRef.current += 1;
    queuedRef.current = 0;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingId(null);
    // A failure that made the person stop is no longer news once it is off.
    setError(null);
  }, []);

  const readMessage = useCallback(
    (message: UIMessage) => {
      const text = replyText(message);
      if (!supported || text.trim().length === 0) return;

      // One voice at a time: asking for a specific reply takes over from whatever
      // is being read. A reply still streaming is left at the point it reached,
      // because the person chose to hear something else instead.
      cancel();
      speakSentences(pendingSpeech(text, 0, true).utterances, message.id);
    },
    [cancel, speakSentences, supported],
  );

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

    speakSentences(pending.utterances, reply.id);
  }, [enabled, isBusy, messages, speakSentences, supported]);

  // Speech outlives a component unless it is stopped; navigating away from the
  // composer must not leave a voice reading a thread that is no longer on screen.
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return { supported, isSpeaking, speakingId, error, cancel, readMessage };
}
