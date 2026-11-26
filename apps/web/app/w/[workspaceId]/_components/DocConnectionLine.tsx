export type DocConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * The line above the editor. Read-only is the strongest state: an archived
 * workspace says so even while the socket is healthy, because the room refuses
 * writes regardless of what the page shows.
 */
export function DocConnectionLine({
  status,
  readOnly,
}: {
  status: DocConnectionStatus;
  readOnly: boolean;
}) {
  if (readOnly) {
    return (
      <p className="doc-status read-only" role="status">
        Read-only — this workspace is archived
      </p>
    );
  }

  if (status === "connected") {
    return (
      <p className="doc-status live" role="status">
        Live
      </p>
    );
  }

  return (
    <p className="doc-status pending" role="status">
      {status === "connecting" ? "Connecting…" : "Reconnecting…"}
    </p>
  );
}
