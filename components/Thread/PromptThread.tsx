"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

import { ThreadMessage } from "./ThreadMessage";

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
