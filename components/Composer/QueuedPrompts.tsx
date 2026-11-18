import type { UIMessage } from "ai";
import { X } from "lucide-react";

import { IconButton } from "@/components/Thread/IconButton";
import { threadText } from "@/lib/ai/thread/parts";

export function QueuedPrompts({
  messages,
  onRemove,
}: {
  messages: UIMessage[];
  onRemove: (id: string) => void;
}) {
  if (messages.length === 0) return null;

  return (
    <ul aria-label="Queued prompts" className="flex flex-col gap-2">
      {messages.map((message) => (
        <li
          key={message.id}
          className="ml-auto flex max-w-[85%] items-start gap-2 rounded-2xl border border-dashed px-3 py-2 text-sm text-muted-foreground"
        >
          <span className="whitespace-pre-wrap">{threadText(message).trim()}</span>
          <IconButton
            label="Remove queued prompt"
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(message.id)}
          >
            <X />
          </IconButton>
        </li>
      ))}
      <li className="ml-auto text-xs text-muted-foreground">
        Queued: the agent takes them one at a time.
      </li>
    </ul>
  );
}
