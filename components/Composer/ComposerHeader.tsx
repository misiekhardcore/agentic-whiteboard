import { Button } from "@konopskidev/ui/components/button";
import { Plus } from "lucide-react";

import type { DashboardConversation } from "@/lib/ai/thread/rules";

import { ConversationHistory } from "./ConversationHistory";
import { ConversationSwitcher } from "./ConversationSwitcher";

export function ComposerHeader({
  conversations,
  conversationId,
  isBusy,
  onNewConversation,
}: {
  conversations: DashboardConversation[];
  conversationId: string;
  isBusy: boolean;
  onNewConversation: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 id="prompt-composer-title" className="page-title text-balance sm:text-display">
          What are we planning today?
        </h1>
        <p className="text-lead text-pretty text-muted-foreground">
          Describe it, and the agent drafts the doc and the canvas for you.
        </p>
      </div>

      {conversations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <ConversationSwitcher conversations={conversations} currentId={conversationId} />
            <ConversationHistory currentId={conversationId} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onNewConversation}
            disabled={isBusy}
          >
            <Plus />
            New conversation
          </Button>
        </div>
      )}
    </div>
  );
}
