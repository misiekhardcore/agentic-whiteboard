"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@konopskidev/ui/components/tooltip";
import type { ComponentProps } from "react";

/**
 * A button whose only content is an icon.
 *
 * The label is both the accessible name and the tooltip, so the two cannot
 * disagree: a meaning that lives only in `aria-label` is invisible to whoever is
 * looking at the screen, and one that lives only in a tooltip is invisible to a
 * screen reader.
 */
export function IconButton({
  label,
  ...props
}: ComponentProps<typeof Button> & {
  /** What the button does, shown on hover and read out by assistive tech. */
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
