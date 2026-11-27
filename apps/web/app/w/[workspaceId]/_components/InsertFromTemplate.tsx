"use client";

import { Button } from "@konopskidev/ui/components/button";
import { useState } from "react";

type InsertState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "done"; applied: number; revision: string }
  | { status: "error"; message: string };

type InsertResponse = {
  applied?: unknown;
  revision?: unknown;
  error?: unknown;
};

function requestKey(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `template-${random}`;
}

/**
 * A holdover control until the proposal interface arrives. It calls the same
 * `doc.append` capability the agent will call, through the server, so the
 * server write path is visible to a person. The request key is stable for this
 * editor session: clicking twice proves the replay applies nothing.
 */
export function InsertFromTemplate({
  workspaceId,
  disabled,
}: {
  workspaceId: string;
  disabled: boolean;
}) {
  const [idempotencyKey] = useState(requestKey);
  const [state, setState] = useState<InsertState>({ status: "idle" });

  const sending = state.status === "sending";
  const buttonDisabled = disabled || sending;

  async function insert(): Promise<void> {
    setState({ status: "sending" });

    try {
      const response = await fetch(`/api/doc/${encodeURIComponent(workspaceId)}/blocks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey }),
        cache: "no-store",
      });
      const body = (await response.json()) as InsertResponse;

      if (!response.ok || typeof body.applied !== "number" || typeof body.revision !== "string") {
        setState({
          status: "error",
          message: typeof body.error === "string" ? body.error : "The insert was refused.",
        });
        return;
      }

      setState({ status: "done", applied: body.applied, revision: body.revision });
    } catch {
      setState({ status: "error", message: "The insert could not reach the server." });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="insert-from-template"
        disabled={buttonDisabled}
        title="Sends the same request key every time, so a retry adds no second block."
        onClick={() => {
          if (!buttonDisabled) void insert();
        }}
      >
        {sending ? "Inserting…" : "Insert from template"}
      </Button>

      {state.status === "done" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {state.applied === 0
            ? `Already applied — one block · ${state.revision}`
            : `Inserted a block · ${state.revision}`}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
