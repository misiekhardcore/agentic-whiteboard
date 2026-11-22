"use client";

import type { UIMessage } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { branchConversationAction } from "@/lib/ai/actions";
import { applyComposerIntent, type ComposerField } from "@/lib/ai/thread/composer";
import { routes } from "@/lib/shared/routes";

import type { AgentSession } from "./useAgentSession";

/**
 * Moving between conversations: copying the thread through a reply into a new
 * one, and starting an empty one. Both leave the agent's current work alone.
 */
export function useConversationNavigation({
  conversationId,
  session,
  composerField,
  resetRetry,
}: {
  conversationId: string;
  session: AgentSession;
  /** What an intent does to the field, dictation included. */
  composerField: ComposerField;
  /** A fresh conversation has nothing stored to retry. */
  resetRetry: () => void;
}) {
  const router = useRouter();
  // The composer does not own the URL: whichever page mounted it keeps the
  // conversations, so the dashboard stays on /dashboard and the panel stays on
  // the workspaces surface it is floating over.
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  // The reply being copied into a new conversation, while the copy is written.
  const [branching, setBranching] = useState<string | null>(null);

  /**
   * Copies the thread through a reply into a new conversation and opens it. The
   * copy is the server's: the branch keeps what was stored, not what this tab
   * happens to be showing, and the original conversation is untouched.
   */
  function branchFrom(message: UIMessage) {
    if (session.isBusy || branching) return;
    applyComposerIntent({ intent: "branch" }, composerField);

    setBranching(message.id);
    startTransition(async () => {
      const result = await branchConversationAction({
        conversationId,
        messageId: message.id,
      });

      if (!result.ok) {
        setBranching(null);
        toast.error(result.error);
        return;
      }

      router.push(routes.conversationAt(pathname, result.conversationId));
    });
  }

  /**
   * Starts an empty thread. The id is made here so the empty conversation is a
   * place the URL can return to, and the first prompt is what creates it.
   */
  function startNewConversation() {
    if (session.isBusy) return;
    applyComposerIntent({ intent: "new-conversation" }, composerField);

    session.clearFailure();
    resetRetry();
    router.push(routes.conversationAt(pathname, crypto.randomUUID()));
  }

  return { branching, branchFrom, startNewConversation };
}
