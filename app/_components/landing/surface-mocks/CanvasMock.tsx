import { MousePointer2, Shapes, Type, Wand2 } from "lucide-react";

import { MockFrame } from "./MockFrame";

export function CanvasMock() {
  return (
    <MockFrame file="checkout-flow.canvas">
      <div className="relative">
        <svg viewBox="0 0 360 270" className="block h-auto w-full" role="presentation">
          <defs>
            <pattern id="canvas-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" className="fill-border" />
            </pattern>
            <marker
              id="canvas-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L8 4 L0 8 Z" className="fill-muted-foreground" />
            </marker>
          </defs>

          <rect width="360" height="270" fill="url(#canvas-dots)" />

          {/* connectors */}
          <g fill="none" className="stroke-muted-foreground/70" strokeWidth="1.25">
            <path d="M122 45 L172 45" markerEnd="url(#canvas-arrow)" />
            <path d="M218 69 L218 88 L76 88 L76 100" markerEnd="url(#canvas-arrow)" />
            <path d="M122 123 L172 123" markerEnd="url(#canvas-arrow)" />
            <path d="M224 140 L224 166" markerEnd="url(#canvas-arrow)" />
          </g>
          <text x="128" y="84" fontSize="8" className="fill-muted-foreground font-sans">
            revises
          </text>

          {/* nodes */}
          <g className="font-sans" fontSize="10.5" textAnchor="middle">
            <g>
              <rect
                x="30"
                y="28"
                width="92"
                height="34"
                rx="3"
                className="fill-card stroke-border"
              />
              <text x="76" y="49" className="fill-foreground font-medium">
                Problem
              </text>
            </g>

            <g>
              <polygon points="218,21 258,45 218,69 178,45" className="fill-card stroke-border" />
              <text x="218" y="49" className="fill-foreground font-medium">
                Scope?
              </text>
            </g>

            <g>
              <rect
                x="30"
                y="106"
                width="92"
                height="34"
                rx="3"
                className="fill-primary/10 stroke-primary"
              />
              <text x="76" y="127" className="fill-primary font-medium">
                Review
              </text>
            </g>

            <g>
              <rect
                x="178"
                y="106"
                width="92"
                height="34"
                rx="3"
                className="fill-card stroke-border"
              />
              <text x="224" y="127" className="fill-foreground font-medium">
                Spec
              </text>
            </g>

            <g>
              <rect
                x="178"
                y="166"
                width="92"
                height="34"
                rx="3"
                className="fill-card stroke-border"
              />
              <text x="224" y="187" className="fill-foreground font-medium">
                Ship
              </text>
            </g>
          </g>

          {/* selection halo around the shape the agent just edited */}
          <rect
            x="22"
            y="98"
            width="108"
            height="50"
            fill="none"
            strokeWidth="1"
            strokeDasharray="3 3"
            className="stroke-primary/60"
          />
          <g className="fill-card stroke-primary" strokeWidth="1">
            <rect x="20.5" y="96.5" width="3" height="3" />
            <rect x="128.5" y="96.5" width="3" height="3" />
            <rect x="20.5" y="146.5" width="3" height="3" />
            <rect x="128.5" y="146.5" width="3" height="3" />
          </g>
        </svg>

        {/* floating tools */}
        <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-sm border bg-card p-0.5 shadow-sm">
          <span className="grid size-6 place-items-center rounded-xs bg-secondary text-foreground">
            <MousePointer2 className="size-3" />
          </span>
          <span className="grid size-6 place-items-center text-muted-foreground">
            <Shapes className="size-3" />
          </span>
          <span className="grid size-6 place-items-center text-muted-foreground">
            <Type className="size-3" />
          </span>
        </div>

        {/* agent instruction */}
        <div className="absolute right-3 bottom-3 flex max-w-50 items-start gap-1.5 rounded-sm border bg-card p-2 shadow-md">
          <Wand2 className="mt-px size-3 shrink-0 text-primary" />
          <p className="text-[10px] leading-snug text-foreground">Add a review step after Scope</p>
        </div>
      </div>
    </MockFrame>
  );
}
