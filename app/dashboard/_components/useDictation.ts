"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  DICTATION_LANGUAGE,
  dictationErrorMessage,
  dictationTranscript,
} from "@/lib/ai/prompt-composer";

/** Support is a fact about the browser, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {
  // The API cannot appear or disappear while the page is open.
};

function browserSupportsSpeech(): boolean {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export type Dictation = {
  /** False where the browser has no Web Speech API, e.g. Firefox. */
  supported: boolean;
  isListening: boolean;
  /** Everything heard in this session, including the phrase still in flight. */
  transcript: string;
  /** Why the last session ended early, or `null`. */
  error: string | null;
  start: () => void;
  stop: () => void;
};

/**
 * Adapts the browser's speech recogniser to the composer: one session at a
 * time, the transcript so far, and a reason when a session fails.
 *
 * Audio never reaches this application — the browser recognizes it against the
 * vendor's speech service and only hands back text. The instance is created on
 * mount rather than at module scope so prerendering stays untouched, and no
 * permission is requested until `start()`.
 */
export function useDictation(): Dictation {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Final phrases and the interim one are kept in refs: recognition events
  // arrive outside React's event system and must not read stale state.
  const finalsRef = useRef<string[]>([]);
  const interimRef = useRef("");
  // The server cannot know, so it renders the button as unavailable and the
  // first client snapshot turns it on without a hydration mismatch.
  const supported = useSyncExternalStore(subscribeToNothing, browserSupportsSpeech, () => false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = DICTATION_LANGUAGE;
    // `continuous` keeps one session open across pauses, and `interimResults`
    // is what lets the composer preview words before they are final.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        if (!result || !alternative) continue;

        if (result.isFinal) finalsRef.current.push(alternative.transcript);
        else interim = alternative.transcript;
      }

      // A final result consumes the interim phrase it replaced, so the interim
      // slot is reset to whatever is still in flight (or nothing).
      interimRef.current = interim;
      setTranscript(dictationTranscript(finalsRef.current, interimRef.current));
    };

    recognition.onerror = (event) => {
      setError(dictationErrorMessage(event.error));
      setIsListening(false);
    };

    // Fires after Stop and after silence ends a session, which is where the
    // composer learns the session is over.
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current = null;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      // Drops an open session without waiting for it to finish.
      recognition.abort();
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    finalsRef.current = [];
    interimRef.current = "";
    setTranscript("");
    setError(null);

    try {
      recognition.start();
    } catch {
      // Chrome throws when a session is already running; that session stands.
      return;
    }

    // Optimistic: the permission prompt and the service handshake take a
    // moment, and the button must show the microphone is opening.
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { supported, isListening, transcript, error, start, stop };
}
