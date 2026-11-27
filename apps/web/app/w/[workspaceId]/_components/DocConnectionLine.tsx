import { Badge } from "@konopskidev/ui/components/badge";

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
      <Badge variant="outline" role="status" className="doc-status read-only text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
        Read-only — this workspace is archived
      </Badge>
    );
  }

  if (status === "connected") {
    return (
      <Badge
        variant="outline"
        role="status"
        className="doc-status live border-success/30 bg-success/10 text-success"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
        Live
      </Badge>
    );
  }

  return (
    <Badge variant="outline" role="status" className="doc-status pending text-muted-foreground">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
      {status === "connecting" ? "Connecting…" : "Reconnecting…"}
    </Badge>
  );
}
