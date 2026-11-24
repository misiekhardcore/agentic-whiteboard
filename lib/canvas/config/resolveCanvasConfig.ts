import { environmentReader } from "@/lib/shared/env";

import type { CanvasConfig, CanvasEnvironment } from "./types";

/** The same address over HTTP, for the service's health read and its revoke call. */
function httpOriginOf(serviceUrl: string): string {
  const url = new URL(serviceUrl);

  return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
}

/**
 * What the app needs to reach the canvas service. `null` means this deployment
 * runs without it: the canvas reports itself unavailable and the rest of the
 * app works, which is a supported state rather than a broken one.
 */
export function resolveCanvasConfig(env: CanvasEnvironment = process.env): CanvasConfig | null {
  const read = environmentReader(env);
  const serviceUrl = read.socketOrigin("NEXT_PUBLIC_CANVAS_SERVICE_URL");
  const serviceSecret = read.value("CANVAS_SERVICE_SECRET");

  if (!serviceUrl || !serviceSecret) return null;

  return { serviceUrl, httpOrigin: httpOriginOf(serviceUrl), serviceSecret };
}
