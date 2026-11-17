"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@konopskidev/ui/components/trace";
import { Wrench } from "lucide-react";

import type { ToolTrace } from "@/lib/ai/thread/parts";

function format(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mt-1 first:mt-0">
      <p className="text-xs font-medium tracking-[0.08em] uppercase">{label}</p>
      <pre className="mt-1 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {format(value)}
      </pre>
    </div>
  );
}

/** The library's status vocabulary; a finished call asks for no decoration. */
function lineStatus(trace: ToolTrace) {
  if (trace.status === "awaiting-approval") return "pending" as const;
  if (trace.status === "done") return undefined;
  return trace.status;
}

/**
 * One tool call in the conversation: what the agent ran, what it ran it on, and
 * whether it worked. The line is the headline; the arguments and the result sit
 * behind it, because a dashboard chat should read as a conversation rather than
 * as a transcript of JSON. A failed call opens by itself — the reason is the
 * point.
 *
 * A call that needs the person's decision is never collapsed: the question and
 * its two answers are the whole line until it is answered.
 */
export function ToolCallLine({
  trace,
  onApproval,
}: {
  trace: ToolTrace;
  /** Answers an outstanding approval; absent when the thread is read-only. */
  onApproval?: (approvalId: string, approved: boolean) => void;
}) {
  const line = (
    <TraceLine status={lineStatus(trace)}>
      <TraceIcon>
        <Wrench />
      </TraceIcon>
      <TraceTitle>{trace.title}</TraceTitle>
      {trace.subject && <TraceTitle className="text-muted-foreground">{trace.subject}</TraceTitle>}
    </TraceLine>
  );

  if (trace.status === "awaiting-approval") {
    return (
      <Trace>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {line}
          {trace.approvalId && onApproval && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApproval(trace.approvalId as string, false)}
              >
                Deny
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onApproval(trace.approvalId as string, true)}
              >
                Approve
              </Button>
            </div>
          )}
        </div>
        {trace.error && <p className="text-xs text-muted-foreground">{trace.error}</p>}
      </Trace>
    );
  }

  const hasDetail =
    trace.error !== null ||
    trace.hint !== null ||
    trace.input !== undefined ||
    trace.output !== undefined;

  if (!hasDetail) return <Trace>{line}</Trace>;

  return (
    <Trace>
      <TraceCollapsible defaultOpen={trace.status === "error"}>
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          {trace.error && <p className="text-destructive">{trace.error}</p>}
          {trace.hint && <p className="text-xs text-muted-foreground">{trace.hint}</p>}
          {trace.input !== undefined && <Detail label="Arguments" value={trace.input} />}
          {trace.output !== undefined && <Detail label="Result" value={trace.output} />}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
