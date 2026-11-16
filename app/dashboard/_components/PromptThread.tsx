"use client";

import type { UIMessage } from "ai";
import { Copy, GitBranch, Pencil, RotateCcw, Square, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { threadBlocks, threadText } from "@/lib/ai/thread/parts";

import { AgentMarkdown } from "./AgentMarkdown";
import { IconButton } from "./IconButton";
import { ToolCallLine } from "./ToolCallLine";

/** Copies a message's prose, which is what the person can see and select. */
async function copyMessage(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to the clipboard");
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
}

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
 * Each message carries its actions, revealed on hover. A prompt can be copied or
 * edited; sending an edited one replaces that turn and everything after it. A
 * reply can be copied, read again, re-run (the newest one only, because that is
 * the turn re-running replaces) or branched into a new conversation that starts
 * with this thread through it. Reading aloud is manual so it works whether or not
 * the preference is on, and a reply that is still arriving has no actions yet:
 * reading half of it would leave the rest unheard, because reading takes over the
 * queue.
 */
function MessageActions({
  message,
  branching,
  editing,
  isNewest,
  onBranch,
  onEdit,
  onRead,
  onRegenerate,
  onStop,
  speaking,
}: {
  message: UIMessage;
  /** This reply is being branched; its actions wait for the copy. */
  branching: boolean;
  /** This is the prompt currently being edited in the composer. */
  editing: boolean;
  /** The thread's newest message, so re-running it replaces nothing after it. */
  isNewest: boolean;
  onBranch?: (message: UIMessage) => void;
  onEdit?: (message: UIMessage) => void;
  onRead?: (message: UIMessage) => void;
  /** Re-runs the newest prompt's turn from the reply. */
  onRegenerate?: () => void;
  /** Stops the reply being read from this card. */
  onStop?: () => void;
  speaking: boolean;
}) {
  const text = threadText(message).trim();
  const isUser = message.role === "user";

  return (
    <div className="flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
      {text.length > 0 && (
        <IconButton
          label={isUser ? "Copy this prompt" : "Copy this reply"}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={() => void copyMessage(text)}
        >
          <Copy />
        </IconButton>
      )}

      {isUser && onEdit && (
        <IconButton
          label="Edit this prompt"
          variant="ghost"
          size="icon-sm"
          aria-pressed={editing}
          className="text-muted-foreground"
          onClick={() => onEdit(message)}
        >
          <Pencil />
        </IconButton>
      )}

      {!isUser && onRead && (
        <IconButton
          label={speaking ? "Stop reading this reply" : "Read this reply aloud"}
          variant="ghost"
          size="icon-sm"
          aria-pressed={speaking}
          className="text-muted-foreground"
          // The button is a toggle: while this reply is being read it stops
          // rather than starting the same reply over.
          onClick={() => (speaking ? onStop?.() : onRead(message))}
        >
          {speaking ? <Square /> : <Volume2 />}
        </IconButton>
      )}

      {!isUser && onRegenerate && isNewest && (
        <IconButton
          label="Regenerate this reply"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={onRegenerate}
        >
          <RotateCcw />
        </IconButton>
      )}

      {!isUser && onBranch && (
        <IconButton
          label="Branch this conversation into a new chat"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          disabled={branching}
          onClick={() => onBranch(message)}
        >
          <GitBranch />
        </IconButton>
      )}
    </div>
  );
}

function ThreadMessage({
  message,
  branching,
  editing,
  isNewest,
  onApproval,
  onBranch,
  onEdit,
  onRead,
  onRegenerate,
  onStop,
  speaking,
  streaming,
}: {
  message: UIMessage;
  /** This reply is being branched; its actions wait for the copy. */
  branching: boolean;
  /** This is the prompt currently being edited in the composer. */
  editing: boolean;
  /** This is the thread's newest message. */
  isNewest: boolean;
  onApproval?: (approvalId: string, approved: boolean) => void;
  /** Present when branching is allowed; absent while the agent is working. */
  onBranch?: (message: UIMessage) => void;
  /** Present when editing is allowed; absent while the agent is working. */
  onEdit?: (message: UIMessage) => void;
  /** Present when the browser can speak; absent where it cannot. */
  onRead?: (message: UIMessage) => void;
  /** Re-runs the newest reply's turn. */
  onRegenerate?: () => void;
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
      <li className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
        <div className="rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {threadText(message).trim()}
        </div>
        {/* Nothing to act on while the agent is working: an edit mid-turn would
            replace the turn the reply is still being written for. */}
        {!streaming && (
          <MessageActions
            message={message}
            branching={branching}
            editing={editing}
            isNewest={isNewest}
            onBranch={onBranch}
            onEdit={onEdit}
            onRead={onRead}
            onRegenerate={onRegenerate}
            onStop={onStop}
            speaking={speaking}
          />
        )}
      </li>
    );
  }

  const canRead = Boolean(onRead) && !streaming && blocks.some((block) => block.kind === "text");

  return (
    <li className="group flex max-w-[85%] flex-col gap-1">
      <div className="flex flex-col gap-2 card px-3 py-2 text-sm">
        {blocks.map((block) =>
          block.kind === "text" ? (
            <AgentMarkdown key={block.key}>{block.text}</AgentMarkdown>
          ) : (
            <ToolCallLine key={block.key} trace={block.trace} onApproval={onApproval} />
          ),
        )}
      </div>

      {/* A reply that is still arriving has nothing to read, copy or re-run
          yet, and a reply without prose has nothing to copy. */}
      {!streaming && (canRead || threadText(message).trim().length > 0) && (
        <MessageActions
          message={message}
          branching={branching}
          editing={editing}
          isNewest={isNewest}
          onBranch={onBranch}
          onEdit={onEdit}
          onRead={canRead ? onRead : undefined}
          onRegenerate={onRegenerate}
          onStop={onStop}
          speaking={speaking}
        />
      )}
    </li>
  );
}

export function PromptThread({
  messages,
  isDrafting,
  branchingId,
  editingId,
  onApproval,
  onBranch,
  onEdit,
  onRead,
  onRegenerate,
  onStop,
  speakingId,
  streamingId,
}: {
  messages: UIMessage[];
  /** The agent is working and has not said anything yet. */
  isDrafting: boolean;
  /** The reply being branched into a new conversation, if any. */
  branchingId?: string | null;
  /** The prompt the composer is editing, if any. */
  editingId?: string | null;
  /** Answers an approval the agent is waiting on. */
  onApproval?: (approvalId: string, approved: boolean) => void;
  /** Branches the conversation through a reply; absent while the agent works. */
  onBranch?: (message: UIMessage) => void;
  /** Starts editing a prompt; absent while the agent is answering. */
  onEdit?: (message: UIMessage) => void;
  /** Reads a reply again; absent where the browser cannot speak. */
  onRead?: (message: UIMessage) => void;
  /** Re-runs the newest reply's turn; absent while the agent works. */
  onRegenerate?: () => void;
  /** Stops the reply being read. */
  onStop?: () => void;
  /** The reply currently being read, if any. */
  speakingId?: string | null;
  /** The reply still arriving, which has no actions yet. */
  streamingId?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the reader is at the bottom; a scroll up is a request to stay put.
  const pinned = useRef(true);
  // The position reached at the last scroll, so a scroll up can be told from the
  // content growing underneath a reader who is already at the bottom.
  const lastTop = useRef(0);
  const hasMessages = messages.length > 0;
  // Re-running a turn is only offered on the newest reply: an older one would
  // discard the turns below it, and that is what editing a prompt is for.
  const newestId = hasMessages ? messages[messages.length - 1]?.id : null;

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
            branching={branchingId === message.id}
            editing={editingId === message.id}
            isNewest={message.id === newestId}
            onApproval={onApproval}
            onBranch={onBranch}
            onEdit={onEdit}
            onRead={onRead}
            onRegenerate={onRegenerate}
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
