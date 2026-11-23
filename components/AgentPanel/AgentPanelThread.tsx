"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import type { UIMessage } from "ai";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useDataChanges } from "@/components/Changes";
import { PromptComposer } from "@/components/Composer/PromptComposer";
import { Loading } from "@/components/Loading/Loading";
import type { AgentPanelViewPayload, ConversationSetPayload } from "@/lib/ai/thread/conversations";
import type { DashboardConversation } from "@/lib/ai/thread/rules";
import { CHANGE_KEYS } from "@/lib/shared/changes";
import { routes } from "@/lib/shared/routes";

type PanelView = {
  conversationId: string;
  messages: UIMessage[];
  canRetry: boolean;
  conversations: DashboardConversation[];
  readAloud: boolean;
  readAloudVoice: string;
};

function toConversations(
  conversations: ConversationSetPayload["conversations"],
): DashboardConversation[] {
  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: new Date(conversation.updatedAt),
  }));
}

function toPanelView(payload: AgentPanelViewPayload): PanelView {
  return {
    conversationId: payload.conversationId,
    messages: payload.messages,
    canRetry: payload.canRetry,
    conversations: toConversations(payload.conversations),
    readAloud: payload.readAloud,
    readAloudVoice: payload.readAloudVoice,
  };
}

async function requestView(
  conversationId: string | null,
  signal?: AbortSignal,
): Promise<AgentPanelViewPayload> {
  const url = new URL(routes.agentConversationViewApi, window.location.origin);
  if (conversationId) url.searchParams.set("conversation", conversationId);

  const response = await fetch(url, { signal });
  const body = (await response.json()) as AgentPanelViewPayload & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Could not open the conversation.");
  }

  return body;
}

/**
 * The live thread inside the panel. The open conversation is
 * `?conversation=<id>`; this is the surface that turns it into the shared
 * conversation set. When an in-section link drops the query, the thread it is
 * showing is restored into the URL, so a reload or a copied link finds it.
 */
export function AgentPanelThread() {
  const pathname = usePathname();
  const requested = useSearchParams().get("conversation");
  const [view, setView] = useState<PanelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadedId = view?.conversationId ?? null;

  useEffect(() => {
    if (!requested && loadedId) return;
    if (requested && requested === loadedId) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const next = toPanelView(await requestView(requested, controller.signal));
        setError(null);
        setView(next);
      } catch (cause) {
        // An aborted read is the panel switching conversations, not a failure.
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not open the conversation.");
      }
    })();

    return () => controller.abort();
  }, [requested, loadedId, attempt]);

  useEffect(() => {
    if (requested || !loadedId) return;
    // Native replace, not a router navigation: restoring the thread into the URL
    // must not compete with a link the person is already following.
    window.history.replaceState(
      window.history.state,
      "",
      routes.conversationAt(pathname, loadedId),
    );
  }, [requested, loadedId, pathname]);

  // The switcher has to learn about a conversation the first prompt created.
  // Only the list is re-read: the live thread belongs to the mounted composer.
  useDataChanges([CHANGE_KEYS.conversations], () => {
    const conversationId = requested ?? view?.conversationId;
    if (!conversationId) return;

    void (async () => {
      try {
        const payload = await requestView(conversationId);
        setView((current) =>
          current ? { ...current, conversations: toConversations(payload.conversations) } : current,
        );
      } catch {
        // The next change, or the next navigation, reads the list again.
      }
    })();
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setAttempt((previous) => previous + 1);
            }}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!view || (requested !== null && requested !== view.conversationId)) {
    return <Loading label="Opening the conversation…" />;
  }

  return (
    <PromptComposer
      key={view.conversationId}
      initialConversationId={view.conversationId}
      initialMessages={view.messages}
      initialCanRetry={view.canRetry}
      initialConversations={view.conversations}
      initialReadAloud={view.readAloud}
      initialReadAloudVoice={view.readAloudVoice}
    />
  );
}
