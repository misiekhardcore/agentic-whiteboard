"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Label } from "@konopskidev/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@konopskidev/ui/components/native-select";
import { Switch } from "@konopskidev/ui/components/switch";
import { useMemo, useState, useTransition } from "react";

import { useSpeechVoices } from "@/components/Voice/useSpeechVoices";
import { READ_ALOUD_LANGUAGE, speechVoiceChoices } from "@/lib/ai/thread/read-aloud";
import { setReadAloudAction, setReadAloudVoiceAction } from "@/lib/identity/actions";

/** What the server confirmed, so the status cannot claim a save still in flight. */
type SavedChoice = { kind: "readAloud"; enabled: boolean } | { kind: "voice"; voice: string };

/**
 * The person's own preferences. Each control applies straight away instead of
 * waiting for a Save button: the setting is a single choice, and the composer's
 * speaker is the same switch in miniature, so the two must not disagree about
 * when a change took effect.
 *
 * The voice list comes from the browser, not the server: names differ by
 * operating system, and only the person's own device knows which are installed.
 * The stored name is the preference; a device that lacks it reads in its own
 * default voice, which is why the picker says so rather than showing an empty
 * field.
 */
export function PreferencesForm({
  initialReadAloud,
  initialReadAloudVoice,
}: {
  initialReadAloud: boolean;
  initialReadAloudVoice: string;
}) {
  const voices = useSpeechVoices();
  const [readAloud, setReadAloud] = useState(initialReadAloud);
  const [voice, setVoice] = useState(initialReadAloudVoice);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedChoice | null>(null);
  const [pending, startTransition] = useTransition();

  const choices = useMemo(() => speechVoiceChoices(voices, READ_ALOUD_LANGUAGE), [voices]);
  const storedMissing = voice.length > 0 && !choices.some((choice) => choice.name === voice);

  function changeReadAloud(enabled: boolean) {
    // Show the new choice first, then put it back if the save was refused
    // rather than leaving the switch claiming a choice that was lost.
    setReadAloud(enabled);
    setError(null);
    setSaved(null);

    startTransition(async () => {
      const result = await setReadAloudAction(enabled);
      if (!result.ok) {
        setReadAloud(!enabled);
        setError(result.error);
        return;
      }

      setSaved({ kind: "readAloud", enabled });
    });
  }

  function changeVoice(next: string) {
    const previous = voice;
    setVoice(next);
    setError(null);
    setSaved(null);

    startTransition(async () => {
      const result = await setReadAloudVoiceAction(next);
      if (!result.ok) {
        setVoice(previous);
        setError(result.error);
        return;
      }

      setSaved({ kind: "voice", voice: next });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="read-aloud">Read agent replies aloud</Label>
          <p id="read-aloud-description" className="text-xs text-muted-foreground">
            Speaks each sentence as the agent writes it, using your browser&apos;s speech synthesis.
            Turning it off stops the queue immediately.
          </p>
        </div>
        <Switch
          id="read-aloud"
          checked={readAloud}
          onCheckedChange={changeReadAloud}
          disabled={pending}
          aria-describedby="read-aloud-description"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="read-aloud-voice">Voice</Label>
        <NativeSelect
          id="read-aloud-voice"
          value={voice}
          onChange={(event) => changeVoice(event.target.value)}
          disabled={pending}
          aria-describedby="read-aloud-voice-description"
          className="max-w-xs"
        >
          <NativeSelectOption value="">Browser default</NativeSelectOption>
          {storedMissing && (
            <NativeSelectOption value={voice}>{voice} (not on this device)</NativeSelectOption>
          )}
          {choices.map((choice) => (
            <NativeSelectOption key={choice.name} value={choice.name}>
              {choice.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p id="read-aloud-voice-description" className="text-xs text-muted-foreground">
          {choices.length === 0
            ? "Your browser has not offered an English voice yet. It appears once the list has loaded."
            : "Voices come from your browser and operating system, so the list differs between devices."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p role="status" className="text-xs text-muted-foreground">
        {pending
          ? "Saving…"
          : saved === null
            ? ""
            : saved.kind === "readAloud"
              ? `Saved. Read aloud is ${saved.enabled ? "on" : "off"}.`
              : `Saved. Replies will be read in ${saved.voice || "your browser's default voice"}.`}
      </p>
    </div>
  );
}
