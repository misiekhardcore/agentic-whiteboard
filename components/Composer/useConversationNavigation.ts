"use client";

import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { branchConversationAction } from "@/lib/ai/actions";
import { routes } from "@/lib/shared/routes";

import type { AgentSession } from "./useAgentSession";
import type { useDraftField } from "./useDraftField";

/**
 * Moving between conversations: copying the thread through a reply into a new
 * one, and starting an empty one. Both leave the agent's current work alone.
 */
export function useConversationNavigation({
  conversationId,
  session,
  field,
  closeDictation,
  speech,
  resetRetry,
}: {
  conversationId: string;
  session: AgentSession;
  field: ReturnType<typeof useDraftField>;
  /** End a live dictation session so it cannot commit over the navigation. */
  closeDictation: () => void;
  speech: { cancel: () => void };
  /** A fresh conversation has nothing stored to retry. */
  resetRetry: () => void;
}) {
  const router = useRouter();
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
    closeDictation();

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

      router.push(routes.dashboardConversation(result.conversationId));
    });
  }

  /**
   * Starts an empty thread. The id is made here so the empty conversation is a
   * place the URL can return to, and the first prompt is what creates it.
   */
  function startNewConversation() {
    if (session.isBusy) return;
    closeDictation();
    speech.cancel();

    field.clear();
    session.clearFailure();
    resetRetry();
    router.push(routes.dashboardConversation(crypto.randomUUID()));
  }

  return { branching, branchFrom, startNewConversation };
}
