"use client";

import { useSync } from "@tldraw/sync";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tldraw } from "tldraw";

import "tldraw/tldraw.css";

import { createCanvasAssetStore } from "./canvasAssetStore";
import { CanvasNotice } from "./CanvasNotice";
import { requestCanvasConnection } from "./requestCanvasConnection";

// A minted address can go stale before the socket opens: the service may have
// stopped after it answered the health read that allowed the mint. Waiting a
// bounded time is what keeps that from reading as a board that never loads.
const FIRST_SYNC_TIMEOUT_MS = 10_000;

/**
 * The board itself, mounted only in the browser. The server's connection
 * answer decides whether it is editable, so an archived workspace's board is
 * read-only through the room rather than through a hidden button.
 *
 * The first connection uses the address the page already minted; every
 * reconnect asks for a new one.
 */
export function CanvasRoom({
  workspaceId,
  initialConnection,
  onRetry,
}: {
  workspaceId: string;
  initialConnection: string;
  onRetry: () => void;
}) {
  const firstConnection = useRef<string | null>(initialConnection);
  const [timedOut, setTimedOut] = useState(false);

  const uri = useCallback(async () => {
    const first = firstConnection.current;
    if (first) {
      firstConnection.current = null;
      return first;
    }

    return requestCanvasConnection(workspaceId);
  }, [workspaceId]);

  // Images belong to the workspace, so they are stored through the app rather
  // than inlined into the document the room relays.
  const assets = useMemo(() => createCanvasAssetStore(workspaceId), [workspaceId]);

  const store = useSync({ uri, assets });

  useEffect(() => {
    if (store.status !== "loading") return;

    const timer = setTimeout(() => setTimedOut(true), FIRST_SYNC_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [store.status]);

  if (store.status === "error" || timedOut) {
    return (
      <CanvasNotice
        title="The canvas is unavailable right now"
        description="The canvas service did not answer. Everything else in this workspace still works; try the canvas again once the service is back."
        action={{ label: "Try again", onClick: onRetry }}
      />
    );
  }

  if (store.status === "loading") {
    return (
      <CanvasNotice
        title="Opening the canvas…"
        description="Loading the board your workspace already holds."
      />
    );
  }

  return (
    <div className="absolute inset-0">
      <Tldraw store={store.store} licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY} />
    </div>
  );
}
