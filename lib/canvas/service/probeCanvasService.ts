/**
 * Whether the canvas service answers right now. A browser is only handed an
 * address when the service is up, so a service that is not running reads as an
 * unavailable canvas instead of a board that never finishes opening. The
 * timeout matters as much as the answer: a black-holed address must not hold
 * the connection request open.
 */
export async function probeCanvasService({
  httpOrigin,
  timeoutMs = 1_500,
  fetch = globalThis.fetch,
}: {
  httpOrigin: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}): Promise<boolean> {
  try {
    const response = await fetch(`${httpOrigin}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}
