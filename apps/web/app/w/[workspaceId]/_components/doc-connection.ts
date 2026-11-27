export type DocConnection = {
  url: string;
  token: string;
  documentName: string;
  readOnly: boolean;
  expiresAt: number;
};

/**
 * One connection attempt's token, freshly minted. Called for the first
 * connection and again after a reconnect, so an expired token is never reused.
 */
export async function requestDocConnection(workspaceId: string): Promise<DocConnection> {
  const response = await fetch(`/api/doc/${encodeURIComponent(workspaceId)}/token`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`document connection refused with status ${response.status}`);
  }

  const body: unknown = await response.json();
  const connection = body as Partial<DocConnection>;

  if (
    typeof connection.url !== "string" ||
    typeof connection.token !== "string" ||
    typeof connection.documentName !== "string" ||
    typeof connection.readOnly !== "boolean"
  ) {
    throw new Error("document connection response was incomplete");
  }

  return {
    url: connection.url,
    token: connection.token,
    documentName: connection.documentName,
    readOnly: connection.readOnly,
    expiresAt: typeof connection.expiresAt === "number" ? connection.expiresAt : 0,
  };
}
