import { type CanvasConfig, resolveCanvasConfig } from "../config";

/**
 * Closes the live sessions of a workspace's canvas, so a board that was already
 * open stops accepting writes the moment the workspace becomes read-only. The
 * client reconnects on its own and asks for a new address, which the token route
 * mints read-only.
 *
 * The archive already happened: a canvas service that cannot be reached must
 * not fail it. The next connection is still minted read-only, so the fallback is
 * a stale board that keeps drawing, not a workspace that cannot be archived.
 */
export async function revokeCanvasSessions({
  workspaceId,
  config = resolveCanvasConfig(),
  timeoutMs = 2_000,
  fetch = globalThis.fetch,
}: {
  workspaceId: string;
  config?: CanvasConfig | null;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}): Promise<boolean> {
  if (!config) return false;

  try {
    const response = await fetch(`${config.httpOrigin}/revoke/${encodeURIComponent(workspaceId)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.serviceSecret}` },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`[canvas] revoking ${workspaceId} was refused with status ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      `[canvas] revoking ${workspaceId} failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return false;
  }
}
