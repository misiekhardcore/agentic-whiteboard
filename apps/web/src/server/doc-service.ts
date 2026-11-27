export type DocService = {
  /** The address the browser's socket dials. */
  wsUrl: string;
  /** The address the app uses for health, snapshot and revoke. */
  httpUrl: string;
  /** The shared secret the app signs with and presents to the service. */
  secret: string;
};

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type DocServiceEnvironment = {
  DOC_SERVICE_URL?: string;
  DOC_SERVICE_INTERNAL_URL?: string;
  DOC_SERVICE_SECRET?: string;
};

/**
 * The app's view of the room owner. A deployment without it is a supported
 * state: the workspace renders, and only the document surface is unavailable.
 */
export function resolveDocService(
  env: DocServiceEnvironment = process.env as DocServiceEnvironment,
): DocService | null {
  const wsUrl = env.DOC_SERVICE_URL;
  const secret = env.DOC_SERVICE_SECRET;
  if (wsUrl === undefined || wsUrl.length === 0) return null;
  if (secret === undefined || secret.length === 0) return null;

  return {
    wsUrl,
    httpUrl: env.DOC_SERVICE_INTERNAL_URL ?? httpOriginOf(wsUrl),
    secret,
  };
}

function httpOriginOf(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(/\/+$/, "");
}

/** A dead service reads as an unavailable surface, never a page that hangs. */
export async function probeDocService(
  service: DocService | null,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  if (service === null) return false;

  try {
    const response = await fetchImpl(`${service.httpUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}
