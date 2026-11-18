"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { DashboardConversation } from "@/lib/ai/thread/rules";
import { routes } from "@/lib/shared/routes";

/** How often the composer asks whether a background title request has finished. */
const TITLE_POLL_INTERVAL_MS = 1_500;

/**
 * How long to keep asking. A local model can take a while to name a conversation,
 * so this is generous; past it the derived label stays until the next prompt
 * schedules another request. A stored title is read on the next page render, so
 * nothing is lost by giving up here.
 */
const TITLE_WATCH_LIMIT_MS = 90_000;

/** The stored title, or null when the conversation is not named yet. */
function titleResponse(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;

  const { title } = body as { title?: unknown };
  return typeof title === "string" && title.length > 0 ? title : null;
}

/**
 * Conversations with the titles generated after the page was rendered.
 *
 * A conversation is named in the background once its first prompt is accepted,
 * so the label starts out derived from that prompt. This hook watches for the
 * stored title — on mount when a title is already being generated (a branch),
 * and after every finished turn — and swaps it in without a reload. Titles are
 * kept apart from the server's list so a refresh cannot put the derived label
 * back.
 *
 * The watch asks for the title itself rather than for a "still working" flag:
 * the naming request runs in the turn's route, so a flag held in that process's
 * memory is not visible to the title read, and an untitled conversation would
 * look abandoned the moment the watch began.
 */
export function useConversationTitles({
  conversationId,
  initialConversations,
}: {
  /** The conversation this composer sends into. */
  conversationId: string;
  /** The server's list, whose untitled entries fall back to their preview. */
  initialConversations: DashboardConversation[];
}) {
  const [generatedTitles, setGeneratedTitles] = useState<Record<string, string>>({});
  // Bumped after each turn, and set on mount for a conversation whose title is
  // already being generated (a branch); zero means nothing is worth waiting for.
  const [attempt, setAttempt] = useState(() =>
    initialConversations.some(
      (conversation) => conversation.id === conversationId && conversation.title === null,
    )
      ? 1
      : 0,
  );

  useEffect(() => {
    if (attempt === 0) return;

    const controller = new AbortController();
    const deadline = Date.now() + TITLE_WATCH_LIMIT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };

    const poll = async () => {
      try {
        const response = await fetch(routes.agentConversationTitleApi(conversationId), {
          signal: controller.signal,
        });

        if (!response.ok) {
          stop();
          return;
        }

        const title = titleResponse(await response.json());

        if (title) {
          setGeneratedTitles((titles) => ({ ...titles, [conversationId]: title }));
          stop();
          return;
        }

        if (Date.now() >= deadline) {
          stop();
          return;
        }

        timer = setTimeout(() => void poll(), TITLE_POLL_INTERVAL_MS);
      } catch {
        // An aborted poll is this effect cleaning up, not a failure to report.
        if (!controller.signal.aborted) stop();
      }
    };

    void poll();

    return () => {
      controller.abort();
      stop();
    };
  }, [attempt, conversationId]);

  /** Watches for a title again; called when a turn that may have scheduled one ends. */
  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  const conversations = useMemo(
    () =>
      initialConversations.map((conversation) => {
        const title = generatedTitles[conversation.id];
        return title ? { ...conversation, title } : conversation;
      }),
    [initialConversations, generatedTitles],
  );

  return { conversations, refresh };
}
