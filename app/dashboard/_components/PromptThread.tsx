"use client";

import { Button } from "@konopskidev/ui/components/button";
import type { UIMessage } from "ai";
import { Square, Volume2 } from "lucide-react";

import { threadBlocks, threadText } from "@/lib/ai/thread/parts";

import { AgentMarkdown } from "./AgentMarkdown";
import { ToolCallLine } from "./ToolCallLine";

/**
 * The dashboard conversation. A person's prompt is shown as they typed it; the
 * agent's reply is markdown with its tool calls listed where they happened, so
 * the thread reads in the order the work was done.
 *
 * A reply with prose carries a small speaker: reading it again is the only way to
 * hear a thread that was read before the preference was on, or to hear one reply
 * twice. It is manual, so it works whether or not the preference is on. A reply
 * that is still arriving has no speaker yet: reading half of it would leave the
 * rest unheard, because the reading takes over the queue.
 */
function ThreadMessage({
  message,
  onApproval,
  onRead,
  onStop,
  speaking,
  streaming,
}: {
  message: UIMessage;
  onApproval?: (approvalId: string, approved: boolean) => void;
  /** Present when the browser can speak; absent where it cannot. */
  onRead?: (message: UIMessage) => void;
  /** Stops the reply being read from this card. */
  onStop?: () => void;
  /** This reply is the one being read. */
  speaking: boolean;
  /** This reply is still being written. */
  streaming: boolean;
}) {
  const blocks = threadBlocks(message);
  if (blocks.length === 0) return null;

  if (message.role === "user") {
    return (
      <li className="ml-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
        {threadText(message).trim()}
      </li>
    );
  }

  const canRead = Boolean(onRead) && !streaming && blocks.some((block) => block.kind === "text");

  return (
    <li className="flex max-w-[85%] flex-col gap-2 card px-3 py-2 text-sm">
      {blocks.map((block) =>
        block.kind === "text" ? (
          <AgentMarkdown key={block.key}>{block.text}</AgentMarkdown>
        ) : (
          <ToolCallLine key={block.key} trace={block.trace} onApproval={onApproval} />
        ),
      )}

      {onRead && canRead && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={speaking ? "Stop reading this reply" : "Read this reply aloud"}
            aria-pressed={speaking}
            className="text-muted-foreground"
            // The button is a toggle: while this reply is being read it stops
            // rather than starting the same reply over.
            onClick={() => (speaking ? onStop?.() : onRead(message))}
          >
            {speaking ? <Square /> : <Volume2 />}
          </Button>
        </div>
      )}
    </li>
  );
}

export function PromptThread({
  messages,
  isDrafting,
  onApproval,
  onRead,
  onStop,
  speakingId,
  streamingId,
}: {
  messages: UIMessage[];
  /** The agent is working and has not said anything yet. */
  isDrafting: boolean;
  /** Answers an approval the agent is waiting on. */
  onApproval?: (approvalId: string, approved: boolean) => void;
  /** Reads a reply again; absent where the browser cannot speak. */
  onRead?: (message: UIMessage) => void;
  /** Stops the reply being read. */
  onStop?: () => void;
  /** The reply currently being read, if any. */
  speakingId?: string | null;
  /** The reply still arriving, which cannot be read again yet. */
  streamingId?: string | null;
}) {
  if (messages.length === 0) return null;

  return (
    <ol aria-label="Agent conversation" className="flex flex-col gap-3" aria-live="polite">
      {messages.map((message) => (
        <ThreadMessage
          key={message.id}
          message={message}
          onApproval={onApproval}
          onRead={onRead}
          onStop={onStop}
          speaking={speakingId === message.id}
          streaming={streamingId === message.id}
        />
      ))}
      {isDrafting && <li className="text-sm text-muted-foreground">The agent is drafting…</li>}
    </ol>
  );
}
