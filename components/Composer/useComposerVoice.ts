"use client";

import type { UIMessage } from "ai";
import type { RefObject } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useDictation } from "@/components/Voice/useDictation";
import { useReadAloud } from "@/components/Voice/useReadAloud";
import { setReadAloudAction } from "@/lib/identity/actions";

/**
 * The composer's voice: dictation writes into the prompt field, read aloud
 * speaks the thread, and the speaker button stores the person's choice.
 */
export function useComposerVoice({
  draft,
  setDraft,
  fieldRef,
  messages,
  isBusy,
  initialReadAloud,
  initialReadAloudVoice,
}: {
  draft: string;
  setDraft: (value: string) => void;
  /** The textarea the words and the focus go into. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  messages: UIMessage[];
  isBusy: boolean;
  /** The person's stored read-aloud preference. */
  initialReadAloud: boolean;
  /** The stored browser voice, or "" for the platform's own default. */
  initialReadAloudVoice: string;
}) {
  const [readAloud, setReadAloud] = useState(initialReadAloud);
  const [, startTransition] = useTransition();
  const dictation = useDictation({ draft, setDraft, fieldRef });
  const speech = useReadAloud({
    messages,
    isBusy,
    enabled: readAloud,
    voiceName: initialReadAloudVoice,
  });

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

  return {
    dictation,
    speech,
    readAloud,
    /** What the textarea shows: the live transcript while dictating. */
    fieldValue: dictation.value,
    toggleReadAloud,
  };
}
