"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@konopskidev/ui/components/tooltip";
import { Mic } from "lucide-react";

/**
 * The microphone beside the prompt field. It stays in the layout when the
 * browser has no speech recognition, disabled with the reason in the tooltip and
 * the hint line, because a missing button reads as a broken composer.
 */
export function DictationButton({
  supported,
  isListening,
  describedBy,
  onToggle,
}: {
  supported: boolean;
  isListening: boolean;
  /** The hint under the field that explains why the microphone is unavailable. */
  describedBy?: string;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button still explains itself through its wrapper. */}
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon-lg"
          className="rounded-full shadow"
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={isListening}
          aria-describedby={supported ? undefined : describedBy}
          disabled={!supported}
          onClick={onToggle}
        >
          <Mic className={isListening ? "animate-pulse" : undefined} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {supported ? "Dictate your prompt" : "Voice input needs Chrome or Safari"}
      </TooltipContent>
    </Tooltip>
  );
}
