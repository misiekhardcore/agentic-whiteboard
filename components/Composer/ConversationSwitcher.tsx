import { Button } from "@konopskidev/ui/components/button";
import Link from "next/link";

import type { DashboardConversation } from "@/lib/ai/thread/rules";
import { routes } from "@/lib/shared/routes";

/**
 * The conversations a person can return to, newest first, labelled by their
 * first prompt. It sits above the thread so starting a new conversation never
 * strands the one they left: the empty thread has an id of its own, and every
 * earlier one is still a click away.
 *
 * Nothing is highlighted while a new thread is still empty, which is the honest
 * answer — that conversation exists only as the id in the URL until its first
 * prompt is accepted.
 */
export function ConversationSwitcher({
  conversations,
  currentId,
  conversationBase,
}: {
  conversations: DashboardConversation[];
  currentId: string;
  /** The pathname that mounted the composer; a link never leaves it. */
  conversationBase: string;
}) {
  if (conversations.length === 0) return null;

  return (
    <div role="group" aria-label="Recent conversations" className="flex flex-wrap gap-1.5">
      {conversations.map((conversation) => {
        const current = conversation.id === currentId;

        return (
          <Button
            key={conversation.id}
            type="button"
            variant={current ? "secondary" : "ghost"}
            size="sm"
            className="h-auto max-w-56 rounded-full py-1 text-xs"
            aria-current={current ? "true" : undefined}
            title={conversation.title}
            asChild
          >
            <Link href={routes.conversationAt(conversationBase, conversation.id)}>
              <span className="truncate">{conversation.title}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
