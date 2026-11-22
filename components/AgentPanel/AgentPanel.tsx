"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import type { UIMessage } from "ai";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useDataChanges } from "@/components/Changes";
import { PromptComposer } from "@/components/Composer/PromptComposer";
import { Loading } from "@/components/Loading/Loading";
import type { AgentPanelViewPayload, ConversationSetPayload } from "@/lib/ai/thread/conversations";
import type { DashboardConversation } from "@/lib/ai/thread/rules";
import { CHANGE_KEYS } from "@/lib/shared/changes";
import { routes } from "@/lib/shared/routes";

import {
  clampPanelWidth,
  COLLAPSED_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  PANEL_LAYOUT_COOKIE,
  type PanelLayout,
  serializePanelLayout,
} from "./panelLayout";

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
 * The agent as a right column of the workspaces section. It is mounted by the
 * section's layout once, so moving between the board and a workspace page keeps
 * the same live thread instead of remounting the composer.
 *
 * The open conversation is `?conversation=<id>`; the mounted panel is the
 * surface that turns that into the shared conversation set. When an in-section
 * link drops the query, the panel keeps the thread it is showing and puts its id
 * back into the URL, so a reload or a copied link still finds it.
 */
export function AgentPanel({ initialLayout }: { initialLayout: PanelLayout }) {
  const pathname = usePathname();
  const requested = useSearchParams().get("conversation");
  const [layout, setLayout] = useState(initialLayout);
  const layoutRef = useRef(layout);
  const resize = useRef<{ startX: number; startWidth: number } | null>(null);

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

  function changeLayout(next: PanelLayout) {
    layoutRef.current = next;
    setLayout(next);
  }

  // The preference is a cookie, the way the sidebar remembers whether it is
  // open: per device, readable by the server on the next visit, and neither a
  // domain field nor a URL parameter.
  function rememberLayout() {
    document.cookie = `${PANEL_LAYOUT_COOKIE}=${serializePanelLayout(layoutRef.current)}; path=/; max-age=31536000; samesite=lax`;
  }

  function toggleCollapsed() {
    changeLayout({ ...layoutRef.current, collapsed: !layoutRef.current.collapsed });
    rememberLayout();
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = { startX: event.clientX, startWidth: layoutRef.current.width };
  }

  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const dragging = resize.current;
    if (!dragging) return;

    // The handle sits on the panel's left edge, so moving left widens it.
    changeLayout({
      ...layoutRef.current,
      width: clampPanelWidth(dragging.startWidth - (event.clientX - dragging.startX)),
    });
  }

  function endResize(event: PointerEvent<HTMLDivElement>) {
    if (!resize.current) return;

    resize.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    rememberLayout();
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowLeft" ? 16 : event.key === "ArrowRight" ? -16 : 0;
    if (step === 0) return;

    event.preventDefault();
    changeLayout({
      ...layoutRef.current,
      width: clampPanelWidth(layoutRef.current.width + step),
    });
    rememberLayout();
  }

  return (
    <div
      className="flex shrink-0"
      style={{ width: layout.collapsed ? COLLAPSED_PANEL_WIDTH : layout.width }}
    >
      <section
        aria-label="Agent panel"
        data-collapsed={layout.collapsed ? "true" : "false"}
        className="relative flex min-w-0 flex-1 flex-col border-l"
      >
        {!layout.collapsed && (
          <div
            role="separator"
            aria-label="Resize agent panel"
            aria-orientation="vertical"
            aria-valuenow={layout.width}
            aria-valuemin={MIN_PANEL_WIDTH}
            aria-valuemax={MAX_PANEL_WIDTH}
            tabIndex={0}
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={resizeWithKeyboard}
            className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none focus-ring"
          />
        )}

        <div
          className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pl-4 ${
            layout.collapsed ? "items-center pt-1" : ""
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              layout.collapsed ? "justify-center" : "justify-between"
            }`}
          >
            {layout.collapsed ? (
              <span className="sr-only">Agent</span>
            ) : (
              <h2 className="text-sm font-semibold">Agent</h2>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={layout.collapsed ? "Expand agent panel" : "Collapse agent panel"}
              onClick={toggleCollapsed}
            >
              {layout.collapsed ? <PanelRightOpen /> : <PanelRightClose />}
            </Button>
          </div>

          {!layout.collapsed &&
            (error ? (
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
            ) : !view || (requested !== null && requested !== view.conversationId) ? (
              <Loading label="Opening the conversation…" />
            ) : (
              <PromptComposer
                key={view.conversationId}
                variant="panel"
                initialConversationId={view.conversationId}
                initialMessages={view.messages}
                initialCanRetry={view.canRetry}
                initialConversations={view.conversations}
                initialReadAloud={view.readAloud}
                initialReadAloudVoice={view.readAloudVoice}
              />
            ))}
        </div>
      </section>
    </div>
  );
}
