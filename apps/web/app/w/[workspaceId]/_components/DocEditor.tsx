"use client";

import { useEffect, useState } from "react";

import { requestDocConnection } from "./doc-connection";
import type { DocConnection } from "./doc-connection";
import { DocNotice } from "./DocNotice";
import { DocRoom } from "./DocRoom";

/**
 * The document island. The engine and its socket are client-only, and the rest
 * of the workspace page renders whether or not this island can open.
 */
export function DocEditor({ workspaceId, readOnly }: { workspaceId: string; readOnly: boolean }) {
  const [connection, setConnection] = useState<DocConnection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    requestDocConnection(workspaceId).then(
      (next) => {
        if (active) setConnection(next);
      },
      () => {
        if (active) setFailed(true);
      },
    );

    return () => {
      active = false;
    };
  }, [workspaceId]);

  if (failed) {
    return (
      <DocNotice
        title="The document is unavailable right now"
        description="The document service did not answer. Everything else in this workspace still works; reload the page to try again."
      />
    );
  }

  if (connection === null) {
    return (
      <DocNotice
        title="Opening the document…"
        description="Connecting to this workspace's document room."
      />
    );
  }

  return <DocRoom workspaceId={workspaceId} readOnly={readOnly} initialConnection={connection} />;
}
