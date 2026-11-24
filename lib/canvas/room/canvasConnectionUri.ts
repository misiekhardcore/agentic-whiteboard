/**
 * The address a browser opens for one connection attempt. The token travels in
 * the query because a browser cannot set headers on a WebSocket handshake; the
 * workspace is a path segment so the service reads it before trusting the token.
 * The client adds its own `sessionId` when it dials, so this address never does.
 */
export function canvasConnectionUri({
  serviceUrl,
  workspaceId,
  token,
}: {
  serviceUrl: string;
  workspaceId: string;
  token: string;
}): string {
  const url = new URL(
    `${serviceUrl.replace(/\/+$/, "")}/connect/${encodeURIComponent(workspaceId)}`,
  );
  url.searchParams.set("token", token);

  return url.toString();
}
