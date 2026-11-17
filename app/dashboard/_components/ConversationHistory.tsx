"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@konopskidev/ui/components/dialog";
import { History } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Loading } from "@/components/Loading/Loading";
import { CONVERSATION_HISTORY_LIMIT, type ConversationHistoryEntry } from "@/lib/ai/thread/rules";
import { formatDay } from "@/lib/shared/format-date";
import { routes } from "@/lib/shared/routes";

/**
 * Every conversation the person has had, behind a button beside the recent
 * pills. The pills are the fast way back to the last few threads; this is the
 * way to the rest of them, which the switcher's handful cannot name.
 */
export function ConversationHistory({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto rounded-full py-1 text-xs"
        >
          <History />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conversation history</DialogTitle>
          <DialogDescription>Every conversation you have had, newest first.</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so each open reads the list again: a
            conversation started in another tab should be there. */}
        <ConversationHistoryList currentId={currentId} onSelect={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog's list. The read belongs to the session, so the endpoint scopes it
 * to the person and no id in the request can select another account's thread.
 */
function ConversationHistoryList({
  currentId,
  onSelect,
}: {
  currentId: string;
  /** Runs before the link navigates, so the dialog is not left over the page. */
  onSelect: () => void;
}) {
  const [entries, setEntries] = useState<ConversationHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the error's retry: it remounts the read rather than leaving a
  // failed request to be asked again by hand.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(routes.agentConversationsApi, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          conversations?: ConversationHistoryEntry[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error ?? "Could not load your conversations.");
        }

        setEntries(body.conversations ?? []);
      } catch (cause) {
        // An aborted read is the dialog closing, not a failure to report.
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load your conversations.");
      }
    })();

    return () => controller.abort();
  }, [attempt]);

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

  if (entries === null) {
    return <Loading label="Loading conversations…" className="py-8" />;
  }

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No conversations yet. Your prompts appear here once you send one.
      </p>
    );
  }

  return (
    <>
      <ul aria-label="All conversations" className="flex max-h-[60vh] flex-col overflow-y-auto">
        {entries.map((entry) => {
          const current = entry.id === currentId;

          return (
            <li key={entry.id}>
              <Link
                href={routes.dashboardConversation(entry.id)}
                onClick={onSelect}
                aria-current={current ? "true" : undefined}
                className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted aria-[current=true]:bg-muted"
              >
                <span className="truncate">{entry.preview}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDay(new Date(entry.updatedAt))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {entries.length === CONVERSATION_HISTORY_LIMIT && (
        <p className="text-xs text-muted-foreground">
          Showing your {CONVERSATION_HISTORY_LIMIT} most recent conversations.
        </p>
      )}
    </>
  );
}
