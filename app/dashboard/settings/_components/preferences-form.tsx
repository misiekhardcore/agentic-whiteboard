"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Label } from "@konopskidev/ui/components/label";
import { Switch } from "@konopskidev/ui/components/switch";
import { useState, useTransition } from "react";

import { setReadAloudAction } from "@/lib/identity/actions";

/**
 * The person's own preferences. Each control applies straight away instead of
 * waiting for a Save button: the setting is a single choice, and the composer's
 * speaker is the same switch in miniature, so the two must not disagree about
 * when a change took effect.
 */
export function PreferencesForm({ initialReadAloud }: { initialReadAloud: boolean }) {
  const [readAloud, setReadAloud] = useState(initialReadAloud);
  const [error, setError] = useState<string | null>(null);
  // The choice the server confirmed, not the one on screen: the announcement
  // must never claim a save that is still in flight or was refused.
  const [saved, setSaved] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

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

      setSaved(enabled);
    });
  }

  return (
    <div className="flex flex-col gap-4">
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
            : `Saved. Read aloud is ${saved ? "on" : "off"}.`}
      </p>
    </div>
  );
}
