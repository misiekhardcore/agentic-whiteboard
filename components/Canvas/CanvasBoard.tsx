"use client";

import { useEffect, useState } from "react";

import { CanvasNotice } from "./CanvasNotice";
import { CanvasRoom } from "./CanvasRoom";
import { requestCanvasConnection } from "./requestCanvasConnection";

type CanvasConnection =
  { status: "opening" } | { status: "unavailable" } | { status: "ready"; uri: string };

/**
 * Gets one connection address before mounting the board, so a canvas service
 * that is down reads as "canvas unavailable" rather than as a board that never
 * finishes loading. The rest of the workspace is untouched either way.
 */
export function CanvasBoard({ workspaceId }: { workspaceId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<CanvasConnection>({ status: "opening" });

  useEffect(() => {
    let cancelled = false;

    requestCanvasConnection(workspaceId)
      .then((uri) => {
        if (!cancelled) setConnection({ status: "ready", uri });
      })
      .catch(() => {
        if (!cancelled) setConnection({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, attempt]);

  const retry = () => {
    setConnection({ status: "opening" });
    setAttempt((count) => count + 1);
  };

  if (connection.status === "unavailable") {
    return (
      <CanvasNotice
        title="The canvas is unavailable right now"
        description="The canvas service is not running. Everything else in this workspace still works; try the canvas again once the service is back."
        action={{ label: "Try again", onClick: retry }}
      />
    );
  }

  if (connection.status === "opening") {
    return (
      <CanvasNotice
        title="Opening the canvas…"
        description="Asking the canvas service for this workspace's board."
      />
    );
  }

  return (
    <CanvasRoom
      key={attempt}
      workspaceId={workspaceId}
      initialConnection={connection.uri}
      onRetry={retry}
    />
  );
}
