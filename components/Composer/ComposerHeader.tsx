import { Button } from "@konopskidev/ui/components/button";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";

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
  // Switcher links stay on the surface that mounted the composer.
  const conversationBase = usePathname();

  return (
    <div className="flex flex-col gap-6">
      {conversations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {" "}
            <ConversationSwitcher
              conversations={conversations}
              currentId={conversationId}
              conversationBase={conversationBase}
            />
            <ConversationHistory currentId={conversationId} conversationBase={conversationBase} />
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
