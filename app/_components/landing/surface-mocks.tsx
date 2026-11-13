import { FileText, MousePointer2, Shapes, Type, Wand2 } from "lucide-react";
import type { ReactNode } from "react";

import type { SurfaceId } from "@/app/_data/landing";
import { cn } from "@/lib/utils";

/**
 * Static product mocks shown beside each feature row. They are illustrations,
 * not interactive surfaces: every one is `aria-hidden` so screen readers hear
 * the copy, not a second-hand description of a screenshot.
 */
export function SurfaceMock({ surface }: { surface: SurfaceId }) {
  switch (surface) {
    case "canvas":
      return <CanvasMock />;
    case "docs":
      return <DocMock />;
    case "team-board":
      return <BoardMock />;
  }
}

function MockFrame({ file, children }: { file: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className="relative overflow-hidden card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rotate-45 bg-primary" />
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {file}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-border" />
          <span className="size-1.5 rounded-full bg-border" />
          <span className="size-1.5 rounded-full bg-border" />
        </div>
      </div>
      {children}
    </div>
  );
}

function CanvasMock() {
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

function DocMock() {
  return (
    <MockFrame file="checkout-spec.doc">
      <div className="relative aspect-4/3 overflow-hidden bg-card px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Docs / Checkout flow
          </p>
          <span className="rounded-sm border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-primary uppercase">
            Agent draft
          </span>
        </div>

        <h3 className="mt-2.5 font-display text-xl font-semibold">Checkout flow — spec</h3>

        <div className="mt-3 space-y-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <p>
            Customers move from cart to confirmation in three steps.{" "}
            <span className="bg-primary/10 text-foreground">Each step is reversible</span> so a
            failed payment never loses the cart.
          </p>

          <div className="rounded-sm border-l-2 border-primary/50 bg-primary/5 px-2.5 py-2">
            <p className="font-sans text-[9px] font-bold tracking-[0.12em] text-primary uppercase">
              Summarized by the agent
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground/80">
              Three-step flow, generated from{" "}
              <span className="font-mono text-[10px]">flow.canvas</span> · 2 min ago
            </p>
          </div>

          <div>
            <p className="font-sans text-[10px] font-bold tracking-[0.12em] text-foreground uppercase">
              Review step
            </p>
            <ul className="mt-1.5 space-y-1">
              <li className="flex items-start gap-1.5">
                <span className="mt-1.25 size-1 shrink-0 rounded-full bg-primary/60" />
                Address and delivery options
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.25 size-1 shrink-0 rounded-full bg-primary/60" />
                Discount code applied inline
              </li>
            </ul>
          </div>
        </div>

        {/* agent actions on the current section */}
        <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-sm border bg-card p-1 shadow-sm">
          <span className="flex items-center gap-1 rounded-xs bg-primary px-1.5 py-1 text-[9px] font-bold text-primary-foreground">
            <Wand2 className="size-2.5" />
            Rewrite
          </span>
          <span className="flex items-center gap-1 px-1.5 py-1 text-[9px] font-medium text-muted-foreground">
            <FileText className="size-2.5" />
            Summarize
          </span>
        </div>
      </div>
    </MockFrame>
  );
}

function BoardMock() {
  return (
    <MockFrame file="team.board">
      <div className="relative aspect-4/3 overflow-hidden bg-muted/30 p-3">
        <div className="grid grid-cols-3 gap-2.5">
          <BoardColumn label="Backlog" count={3} marker="bg-border">
            <BoardCard title="Pricing page" tag="docs" />
            <BoardCard title="Onboarding flow" tag="canvas" />
            <BoardCard title="Mobile nav" tag="canvas" />
          </BoardColumn>

          <BoardColumn
            label="In progress"
            count={2}
            marker="bg-chart-3"
            className="border-primary/40 bg-primary/5"
          >
            <BoardCard title="Checkout diagram" tag="canvas" highlighted />
            <BoardCard title="Auth spec" tag="docs" />
          </BoardColumn>

          <BoardColumn label="Shipped" count={2} marker="bg-success">
            <BoardCard title="Q4 roadmap" tag="board" />
            <BoardCard title="API architecture" tag="canvas" />
          </BoardColumn>
        </div>

        <LiveCursor name="Maya" tone="amber" className="top-[43%] left-[38%]" />
        <LiveCursor name="Ari" tone="violet" className="top-[64%] left-[8%]" />
      </div>
    </MockFrame>
  );
}

function BoardColumn({
  label,
  count,
  marker,
  className,
  children,
}: {
  label: string;
  count: number;
  marker: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-sm border bg-background/70 p-1.5", className)}>
      <div className="flex items-center justify-between gap-1 px-0.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", marker)} />
          <span className="text-[9.5px] font-bold tracking-wide text-foreground uppercase">
            {label}
          </span>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function BoardCard({
  title,
  tag,
  highlighted = false,
}: {
  title: string;
  tag: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border bg-card px-2 py-1.5 shadow-xs",
        highlighted && "border-primary/50",
      )}
    >
      <p className="text-[10.5px] leading-snug font-medium text-foreground">{title}</p>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="rounded-xs bg-secondary px-1 py-px font-mono text-[8px] tracking-[0.08em] text-muted-foreground uppercase">
          {tag}
        </span>
        <span className="flex items-center">
          <span className="size-2.5 rounded-full border border-card bg-chart-5" />
          <span className="-ml-1 size-2.5 rounded-full border border-card bg-chart-4" />
        </span>
      </div>
    </div>
  );
}

function LiveCursor({
  name,
  tone,
  className,
}: {
  name: string;
  tone: "amber" | "violet";
  className?: string;
}) {
  return (
    <div className={cn("pointer-events-none absolute z-10", className)}>
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "size-3.5 -rotate-6 drop-shadow-sm",
          tone === "amber" ? "fill-chart-3" : "fill-chart-4",
        )}
        role="presentation"
      >
        <path d="M4.5 2.5 20 11.5l-7.3 1.2-3.4 6.6z" />
      </svg>
      <span
        className={cn(
          "-mt-0.5 ml-3 inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm",
          tone === "amber" ? "bg-chart-3" : "bg-chart-4",
        )}
      >
        {name}
      </span>
    </div>
  );
}
