import type { UIMessage } from "ai";

import { threadBlocks, threadText } from "@/lib/ai/thread/parts";

import { AgentMarkdown } from "./AgentMarkdown";
import { MessageActions } from "./MessageActions";
import { ToolCallLine } from "./ToolCallLine";

export function ThreadMessage({
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
