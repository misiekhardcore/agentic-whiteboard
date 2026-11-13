"use client";

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

import type { ToolTrace } from "@/lib/ai/thread-parts";

function format(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mt-1 first:mt-0">
      <p className="text-xs font-medium uppercase tracking-[0.08em]">{label}</p>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed">
        {format(value)}
      </pre>
    </div>
  );
}

/**
 * One tool call in the conversation: what the agent ran, what it ran it on, and
 * whether it worked. The line is the headline; the arguments and the result sit
 * behind it, because a dashboard chat should read as a conversation rather than
 * as a transcript of JSON. A failed call opens by itself — the reason is the
 * point.
 */
export function ToolCallLine({ trace }: { trace: ToolTrace }) {
  // A finished call is the plain state; only a call still working or one that
  // failed asks the line to say so.
  const status = trace.status === "done" ? undefined : trace.status;

  const line = (
    <TraceLine status={status}>
      <TraceIcon>
        <Wrench />
      </TraceIcon>
      <TraceTitle>{trace.title}</TraceTitle>
      {trace.subject && (
        <TraceTitle className="text-muted-foreground">{trace.subject}</TraceTitle>
      )}
    </TraceLine>
  );

  const hasDetail =
    trace.error !== null ||
    trace.input !== undefined ||
    trace.output !== undefined;

  if (!hasDetail) return <Trace>{line}</Trace>;

  return (
    <Trace>
      <TraceCollapsible defaultOpen={trace.status === "error"}>
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          {trace.error && <p className="text-destructive">{trace.error}</p>}
          {trace.input !== undefined && (
            <Detail label="Arguments" value={trace.input} />
          )}
          {trace.output !== undefined && (
            <Detail label="Result" value={trace.output} />
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
