import { Button } from "@konopskidev/ui/components/button";
import Link from "next/link";

import { conversationLabel, type DashboardConversation } from "@/lib/ai/thread/rules";
import { routes } from "@/lib/shared/routes";

/**
 * The conversations a person can return to, newest first, labelled by their
 * generated title when one exists and by their first prompt until then. It sits
 * above the thread so starting a new conversation never strands the one they
 * left: the empty thread has an id of its own, and every earlier one is still a
 * click away.
 *
 * Nothing is highlighted while a new thread is still empty, which is the honest
 * answer — that conversation exists only as the id in the URL until its first
 * prompt is accepted.
 */
export function ConversationSwitcher({
  conversations,
  currentId,
}: {
  conversations: DashboardConversation[];
  currentId: string;
}) {
  if (conversations.length === 0) return null;

  return (
    <div role="group" aria-label="Recent conversations" className="flex flex-wrap gap-1.5">
      {conversations.map((conversation) => {
        const current = conversation.id === currentId;
        const label = conversationLabel(conversation);

        return (
          <Button
            key={conversation.id}
            type="button"
            variant={current ? "secondary" : "ghost"}
            size="sm"
            className="h-auto max-w-56 rounded-full py-1 text-xs"
            aria-current={current ? "true" : undefined}
            title={label}
            asChild
          >
            <Link href={routes.dashboardConversation(conversation.id)}>
              <span className="truncate">{label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
