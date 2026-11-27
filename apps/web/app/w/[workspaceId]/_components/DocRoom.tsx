"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import { DOC_META_FIELD, DOC_REVISION_FIELD } from "@v2/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { requestDocConnection } from "./doc-connection";
import type { DocConnection } from "./doc-connection";
import { DocConnectionLine } from "./DocConnectionLine";
import type { DocConnectionStatus } from "./DocConnectionLine";
import { DocSurface } from "./DocSurface";
import { DocToolbar } from "./DocToolbar";
import { InsertFromTemplate } from "./InsertFromTemplate";

/**
 * The editor itself, mounted only in the browser. The room decides read-only
 * from the token; the editor follows that answer, so an archived workspace's
 * toolbar is disabled and the reason is shown.
 */
export function DocRoom({
  workspaceId,
  readOnly,
  initialConnection,
}: {
  workspaceId: string;
  readOnly: boolean;
  initialConnection: DocConnection;
}) {
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [status, setStatus] = useState<DocConnectionStatus>("connecting");
  const [connectionReadOnly, setConnectionReadOnly] = useState(
    readOnly || initialConnection.readOnly,
  );
  const [revision, setRevision] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "refused">("idle");
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const [synced, setSynced] = useState(false);

  // The provider owns a socket, so it is created and destroyed with the
  // effect. The Y.Doc outlives it: StrictMode mounts effects twice in
  // development, and destroying the shared document would leave the editor
  // typing into a document no provider is listening to.
  useEffect(() => {
    const provider = new HocuspocusProvider({
      url: initialConnection.url,
      name: initialConnection.documentName,
      document: ydoc,
      // Every attempt, including the first, asks for a fresh token, so an
      // expired one never travels and an archived workspace is re-answered
      // read-only after the room closes its live sessions.
      token: async () => {
        const connection = await requestDocConnection(workspaceId);
        setConnectionReadOnly(connection.readOnly);
        return connection.token;
      },
      onStatus: ({ status: next }) => setStatus(next),
      onSynced: () => setSynced(true),
      onAuthenticationFailed: () => setStatus("disconnected"),
    });

    return () => {
      provider.destroy();
    };
  }, [initialConnection, workspaceId, ydoc]);

  // The revision travels inside the document, so the socket that delivers a
  // change also delivers the number: no second channel and no reload.
  useEffect(() => {
    const read = () => {
      const value = ydoc.getMap(DOC_META_FIELD).get(DOC_REVISION_FIELD);
      setRevision(typeof value === "number" ? value : 0);
    };

    ydoc.on("update", read);
    read();

    return () => {
      ydoc.off("update", read);
    };
  }, [ydoc]);

  const save = useCallback(async () => {
    setSaveState("saving");

    try {
      const response = await fetch(`/api/doc/${encodeURIComponent(workspaceId)}/save`, {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as { revision?: unknown };

      if (!response.ok || typeof body.revision !== "string") {
        setSaveState("refused");
        return;
      }

      const number = /^rev-(\d+)$/.exec(body.revision)?.[1];
      setSavedRevision(number === undefined ? null : Number(number));
      setSaveState("saved");
    } catch {
      setSaveState("refused");
    }
  }, [workspaceId]);

  // Ctrl+S (and Cmd+S) save through the same capability an agent will use; a
  // read-only room refuses before the room owner is asked.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;

      event.preventDefault();
      if (connectionReadOnly || status !== "connected") return;
      void save();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [connectionReadOnly, save, status]);

  const barSide = (
    <>
      <p className="doc-revision text-sm text-muted-foreground" data-testid="doc-revision">
        revision <span className="font-mono text-foreground">{revision ?? "—"}</span>
      </p>
      {saveState === "saving" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Saving…
        </p>
      ) : null}
      {saveState === "saved" && savedRevision !== null ? (
        <p className="text-sm text-muted-foreground" role="status">
          Saved · rev-{savedRevision}
        </p>
      ) : null}
      {saveState === "refused" ? (
        <p className="text-sm text-destructive" role="status">
          The save was refused.
        </p>
      ) : null}
      <InsertFromTemplate
        workspaceId={workspaceId}
        disabled={connectionReadOnly || status !== "connected"}
      />
      <DocConnectionLine status={status} readOnly={connectionReadOnly} />
    </>
  );

  // The editor waits for the first sync: see DocSurface for why mounting it
  // against an empty document leaves a block behind on every load.
  if (!synced) {
    return (
      <div className="flex flex-col">
        <div className="doc-bar flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
          <DocToolbar editor={null} readOnly={connectionReadOnly} />
          <div className="doc-bar-side">{barSide}</div>
        </div>
        <div className="doc-editor flex-1" />
      </div>
    );
  }

  return (
    <DocSurface ydoc={ydoc} readOnly={connectionReadOnly}>
      {barSide}
    </DocSurface>
  );
}
