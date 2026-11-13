"use client";

import type { UIMessage } from "ai";

import { threadBlocks, threadText } from "@/lib/ai/thread-parts";

import { AgentMarkdown } from "./AgentMarkdown";
import { ToolCallLine } from "./ToolCallLine";

/**
 * The dashboard conversation. A person's prompt is shown as they typed it; the
 * agent's reply is markdown with its tool calls listed where they happened, so
 * the thread reads in the order the work was done.
 */
function ThreadMessage({ message }: { message: UIMessage }) {
  const blocks = threadBlocks(message);
  if (blocks.length === 0) return null;

  if (message.role === "user") {
    return (
      <li className="ml-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
        {threadText(message).trim()}
      </li>
    );
  }

  return (
    <li className="card flex max-w-[85%] flex-col gap-2 px-3 py-2 text-sm">
      {blocks.map((block) =>
        block.kind === "text" ? (
          <AgentMarkdown key={block.key}>{block.text}</AgentMarkdown>
        ) : (
          <ToolCallLine key={block.key} trace={block.trace} />
        ),
      )}
    </li>
  );
}

export function PromptThread({
  messages,
  isDrafting,
}: {
  messages: UIMessage[];
  /** The agent is working and has not said anything yet. */
  isDrafting: boolean;
}) {
  if (messages.length === 0) return null;

  return (
    <ol
      aria-label="Agent conversation"
      className="flex flex-col gap-3"
      aria-live="polite"
    >
      {messages.map((message) => (
        <ThreadMessage key={message.id} message={message} />
      ))}
      {isDrafting && (
        <li className="text-sm text-muted-foreground">The agent is drafting…</li>
      )}
    </ol>
  );
}
