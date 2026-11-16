import type { UIMessage } from "ai";
import { Copy, GitBranch, Pencil, RotateCcw, Square, Volume2 } from "lucide-react";

import { threadText } from "@/lib/ai/thread/parts";

import { copyToClipboard } from "./copyToClipboard";
import { IconButton } from "./IconButton";

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
export function MessageActions({
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
          onClick={() => void copyToClipboard(text)}
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
