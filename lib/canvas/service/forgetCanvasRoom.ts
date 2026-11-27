import { type CanvasConfig, resolveCanvasConfig } from "../config";

/**
 * Deletes a deleted workspace's canvas working store. The row is already gone,
 * so a surviving store is a file nothing can reopen; the service also sweeps a
 * store whose call never arrived, which is why a failure here must not fail the
 * delete.
 */
export async function forgetCanvasRoom({
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
    const response = await fetch(`${config.httpOrigin}/forget/${encodeURIComponent(workspaceId)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.serviceSecret}` },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`[canvas] forgetting ${workspaceId} was refused with status ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      `[canvas] forgetting ${workspaceId} failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return false;
  }
}
