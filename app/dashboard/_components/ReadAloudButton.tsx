"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@konopskidev/ui/components/tooltip";
import { Volume2, VolumeX } from "lucide-react";

/**
 * The speaker beside the prompt field. The preference is stored server-side and
 * belongs to the person, so the button states the choice and announces it as a
 * toggle; it stays visible but disabled where the browser has no speech
 * synthesizer, because a missing button reads as a broken composer.
 */
export function ReadAloudButton({
  supported,
  enabled,
  isSpeaking,
  onToggle,
}: {
  supported: boolean;
  enabled: boolean;
  isSpeaking: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={enabled ? "secondary" : "outline"}
          size="icon-lg"
          className="rounded-full shadow"
          aria-label={enabled ? "Turn off read aloud" : "Turn on read aloud"}
          aria-pressed={enabled}
          disabled={!supported}
          onClick={onToggle}
        >
          {enabled ? <Volume2 className={isSpeaking ? "animate-pulse" : undefined} /> : <VolumeX />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {supported
          ? enabled
            ? isSpeaking
              ? "Reading the reply aloud"
              : "Read aloud is on"
            : "Read agent replies aloud"
          : "Read aloud needs browser speech synthesis"}
      </TooltipContent>
    </Tooltip>
  );
}
