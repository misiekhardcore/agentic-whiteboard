"use client";

import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { browserSupportsSpeech, subscribeToNothing } from "@/components/Voice/browserSupport";
import {
  type ComposerSelection,
  DICTATION_LANGUAGE,
  dictationErrorMessage,
  dictationTranscript,
  withTranscript,
} from "@/lib/ai/thread/composer";

/** The draft and caret captured when a session starts. */
type DictationSession = {
  draft: string;
  selection: ComposerSelection;
};

export type DictationField = {
  /** The draft as the composer holds it, before any words heard. */
  draft: string;
  setDraft: (next: string) => void;
  /** The textarea the words go into, for the caret and the focus. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
};

export type Dictation = {
  /** False where the browser has no Web Speech API, e.g. Firefox. */
  supported: boolean;
  isListening: boolean;
  /** The draft to render: the captured draft with the words heard so far. */
  value: string;
  /** Why the last session ended early, or `null`. */
  error: string | null;
  /** Starts a session at the caret, or ends the open one and keeps its words. */
  toggle: () => void;
  /** Ends an open session without inserting anything. */
  discard: () => void;
};

/**
 * Adapts the browser's speech recogniser to the composer's draft: one session at
 * a time, the words spliced in at the caret the microphone opened at, and a
 * reason when a session fails.
 *
 * The session runs against the draft it captured rather than the live one, so a
 * phrase that becomes final replaces its preview instead of being added twice.
 * Whatever was heard is committed as ordinary editable text when the session
 * ends — dictation is input, never submission.
 *
 * Audio never reaches this application — the browser recognizes it against the
 * vendor's speech service and only hands back text. The instance is created on
 * mount rather than at module scope so prerendering stays untouched, and no
 * permission is requested until `toggle()`.
 */
export function useDictation({ draft, setDraft, fieldRef }: DictationField): Dictation {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Final phrases and the interim one are kept in refs: recognition events
  // arrive outside React's event system and must not read stale state.
  const finalsRef = useRef<string[]>([]);
  const interimRef = useRef("");
  // The server cannot know, so it renders the microphone as unavailable and the
  // first client snapshot turns it on without a hydration mismatch.
  const supported = useSyncExternalStore(subscribeToNothing, browserSupportsSpeech, () => false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DictationSession | null>(null);
  // Mirrors the session for the commit effect, which must not restart when the
  // captured draft would be captured again, and holds the caret to restore once
  // the committed words are in the field.
  const sessionRef = useRef<DictationSession | null>(null);
  const wasListeningRef = useRef(false);
  const caretRef = useRef<number | null>(null);

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
    recognition.unspokenPunctuation = true;

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

  // A session ends on Stop, on silence or on an error. Whatever was heard is
  // committed into the draft there as ordinary editable text — never sent.
  useEffect(() => {
    if (isListening) {
      wasListeningRef.current = true;
      return;
    }
    if (!wasListeningRef.current) return;
    wasListeningRef.current = false;

    const captured = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    if (!captured) return;

    const inserted = withTranscript(captured.draft, captured.selection, transcript);
    if (!inserted) {
      fieldRef.current?.focus();
      return;
    }

    caretRef.current = inserted.caret;
    setDraft(inserted.text);
  }, [isListening, transcript, fieldRef, setDraft]);

  // Put the caret after the committed words once they are in the field, so the
  // person can correct them by typing where speech stopped.
  useEffect(() => {
    const caret = caretRef.current;
    if (caret === null) return;
    caretRef.current = null;

    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(caret, caret);
  }, [draft, fieldRef]);

  function startRecognition() {
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
  }

  function stopRecognition() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Chrome throws when nothing is running; there is no session to end.
    }
  }

  function toggle() {
    if (isListening) {
      stopRecognition();
      return;
    }

    // The words go where the caret was when the microphone opened, even if the
    // person clicks around the field while speaking.
    const field = fieldRef.current;
    const captured: DictationSession = {
      draft,
      selection: {
        start: field?.selectionStart ?? draft.length,
        end: field?.selectionEnd ?? draft.length,
      },
    };

    sessionRef.current = captured;
    setSession(captured);
    startRecognition();
  }

  function discard() {
    // The draft is about to be replaced, so nothing heard belongs in it.
    wasListeningRef.current = false;
    sessionRef.current = null;
    setSession(null);
    stopRecognition();
    fieldRef.current?.focus();
  }

  // While dictating, the field shows the captured draft with the words heard so
  // far spliced in at the captured caret.
  const spoken = session ? withTranscript(session.draft, session.selection, transcript) : null;

  return { supported, isListening, value: spoken?.text ?? draft, error, toggle, discard };
}
