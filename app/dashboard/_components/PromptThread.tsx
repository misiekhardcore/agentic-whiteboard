"use client";

import { Button } from "@konopskidev/ui/components/button";
import type { UIMessage } from "ai";
import { Pencil, Square, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { threadBlocks, threadText } from "@/lib/ai/thread/parts";

import { AgentMarkdown } from "./AgentMarkdown";
import { ToolCallLine } from "./ToolCallLine";

/**
 * The dashboard conversation. A person's prompt is shown as they typed it; the
 * agent's reply is markdown with its tool calls listed where they happened, so
 * the thread reads in the order the work was done.
 *
 * The thread is its own scroll region with a fixed maximum height: a long
 * conversation must not push the composer off the page or turn the whole
 * dashboard into one endless column. It follows the newest message while the
 * reader is at the bottom, and stops following the moment they scroll up, so a
 * reply that is still arriving does not yank them away from something they are
 * reading.
 *
 * A prompt carries an edit control: sending an edited one replaces that turn and
 * everything after it. A reply with prose carries a small speaker: reading it
 * again is the only way to hear a thread that was read before the preference was
 * on, or to hear one reply twice. It is manual, so it works whether or not the
 * preference is on. A reply that is still arriving has no speaker yet: reading
 * half of it would leave the rest unheard, because the reading takes over the
 * queue.
 */
function ThreadMessage({
  message,
  editing,
  onApproval,
  onEdit,
  onRead,
  onStop,
  speaking,
  streaming,
}: {
  message: UIMessage;
  /** This is the prompt currently being edited in the composer. */
  editing: boolean;
  onApproval?: (approvalId: string, approved: boolean) => void;
  /** Present when editing is allowed; absent while the agent is working. */
  onEdit?: (message: UIMessage) => void;
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
      <li className="ml-auto flex max-w-[85%] items-start gap-1.5">
        <div className="rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {threadText(message).trim()}
        </div>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit this prompt"
            aria-pressed={editing}
            className="mt-1 text-muted-foreground"
            onClick={() => onEdit(message)}
          >
            <Pencil />
          </Button>
        )}
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
  editingId,
  onApproval,
  onEdit,
  onRead,
  onStop,
  speakingId,
  streamingId,
}: {
  messages: UIMessage[];
  /** The agent is working and has not said anything yet. */
  isDrafting: boolean;
  /** The prompt the composer is editing, if any. */
  editingId?: string | null;
  /** Answers an approval the agent is waiting on. */
  onApproval?: (approvalId: string, approved: boolean) => void;
  /** Starts editing a prompt; absent while the agent is answering. */
  onEdit?: (message: UIMessage) => void;
  /** Reads a reply again; absent where the browser cannot speak. */
  onRead?: (message: UIMessage) => void;
  /** Stops the reply being read. */
  onStop?: () => void;
  /** The reply currently being read, if any. */
  speakingId?: string | null;
  /** The reply still arriving, which cannot be read again yet. */
  streamingId?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the reader is at the bottom; a scroll up is a request to stay put.
  const pinned = useRef(true);
  // The position reached at the last scroll, so a scroll up can be told from the
  // content growing underneath a reader who is already at the bottom.
  const lastTop = useRef(0);
  const hasMessages = messages.length > 0;

  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (!element) return;

    // Instant, not the page's smooth scrolling: a long thread must open at its
    // newest message rather than roll down to it, and following a stream cannot
    // animate behind the words.
    element.scrollTo({ top: element.scrollHeight, behavior: "instant" });
    lastTop.current = element.scrollTop;
  };

  // Streaming changes the list on every chunk, and the reply can reflow after
  // the words arrive (fonts, markdown), so follow both the renders and the
  // content's height.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !hasMessages) return;

    const follow = () => {
      if (pinned.current) scrollToBottom();
    };
    const observer = new ResizeObserver(follow);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    follow();

    return () => observer.disconnect();
  }, [hasMessages]);

  useEffect(() => {
    if (pinned.current) scrollToBottom();
  }, [messages, isDrafting]);

  if (!hasMessages) return null;

  return (
    <div
      ref={scrollRef}
      // Growing content (a reply still arriving) does not move the scroll
      // position, so only an upward scroll is a request to stop following.
      onScroll={(event) => {
        const element = event.currentTarget;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;

        if (element.scrollTop < lastTop.current - 2) pinned.current = false;
        else if (distance < 48) pinned.current = true;

        lastTop.current = element.scrollTop;
      }}
      className="max-h-[min(60vh,40rem)] overflow-y-auto overscroll-contain rounded-xl p-1"
    >
      <ol aria-label="Agent conversation" className="flex flex-col gap-3" aria-live="polite">
        {messages.map((message) => (
          <ThreadMessage
            key={message.id}
            message={message}
            editing={editingId === message.id}
            onApproval={onApproval}
            onEdit={onEdit}
            onRead={onRead}
            onStop={onStop}
            speaking={speakingId === message.id}
            streaming={streamingId === message.id}
          />
        ))}
        {isDrafting && <li className="text-sm text-muted-foreground">The agent is drafting…</li>}
      </ol>
    </div>
  );
}
