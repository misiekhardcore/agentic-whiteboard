"use client";

import { Button } from "@konopskidev/ui/components/button";

/** What the canvas area says while it is opening, or when it cannot open. */
export function CanvasNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center"
      data-testid="canvas-notice"
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
