"use client";

import dynamic from "next/dynamic";

import { CanvasNotice } from "./CanvasNotice";

// The engine touches the DOM at import time, so the board is loaded only in
// the browser. Its stylesheet travels with this chunk, which is loaded once per
// page rather than once per render.
const CanvasBoard = dynamic(() => import("./CanvasBoard").then((module) => module.CanvasBoard), {
  ssr: false,
  loading: () => (
    <CanvasNotice
      title="Opening the canvas…"
      description="The board loads in the browser in a moment."
    />
  ),
});

/** The workspace's canvas, sized by the page: the section takes the room left. */
export function CanvasSection({ workspaceId }: { workspaceId: string }) {
  return (
    <div
      className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-border/60 bg-muted/20"
      data-testid="workspace-canvas"
    >
      <CanvasBoard workspaceId={workspaceId} />
    </div>
  );
}
