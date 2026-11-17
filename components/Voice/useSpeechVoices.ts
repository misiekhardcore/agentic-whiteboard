"use client";

import { useEffect, useState } from "react";

/**
 * The browser's voices, once it has loaded them.
 *
 * The list is not available at mount on Chromium: it answers an empty array
 * until the vendor voices are fetched, then fires `voiceschanged`. Reading it
 * once would leave the picker empty and every reply in the default voice, so the
 * list is read again on that event. Nothing changes after the browser has
 * settled, and the API is absent on the server, so the first snapshot is empty
 * and the effect fills it in without a hydration mismatch.
 */
export function useSpeechVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const synthesis = window.speechSynthesis;
    const load = () => setVoices(synthesis.getVoices());

    load();
    // A test double or a stripped-down browser may have no events at all.
    if (typeof synthesis.addEventListener !== "function") return;
    synthesis.addEventListener("voiceschanged", load);

    return () => synthesis.removeEventListener("voiceschanged", load);
  }, []);

  return voices;
}
