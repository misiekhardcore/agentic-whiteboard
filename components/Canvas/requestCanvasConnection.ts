/**
 * One connection attempt's address, freshly minted. Called for the first
 * connection and for every reconnect, so a token is never reused after it
 * expires.
 */
export async function requestCanvasConnection(workspaceId: string): Promise<string> {
  const response = await fetch(`/api/canvas/${encodeURIComponent(workspaceId)}/token`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`canvas connection refused with status ${response.status}`);
  }

  const body: unknown = await response.json();
  const uri = (body as { uri?: unknown }).uri;
  if (typeof uri !== "string" || uri.length === 0) {
    throw new Error("canvas connection response carried no address");
  }

  return uri;
}
