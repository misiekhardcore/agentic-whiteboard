import { CanvasConfigurationError } from "./CanvasConfigurationError";
import type { CanvasConfig, CanvasEnvironment } from "./types";

const HTTP_ORIGIN_BY_SCHEME: Record<string, string> = {
  "ws:": "http:",
  "wss:": "https:",
};

/**
 * What the app needs to reach the canvas service. `null` means this deployment
 * runs without it: the canvas reports itself unavailable and the rest of the
 * app works, which is a supported state rather than a broken one.
 */
export function resolveCanvasConfig(env: CanvasEnvironment = process.env): CanvasConfig | null {
  const serviceUrl = env.NEXT_PUBLIC_CANVAS_SERVICE_URL?.trim().replace(/\/+$/, "");
  const serviceSecret = env.CANVAS_SERVICE_SECRET?.trim();

  if (!serviceUrl || !serviceSecret) return null;

  const url = new URL(serviceUrl);
  const protocol = HTTP_ORIGIN_BY_SCHEME[url.protocol];
  if (!protocol) {
    throw new CanvasConfigurationError(
      `NEXT_PUBLIC_CANVAS_SERVICE_URL must be a ws:// or wss:// address, received "${serviceUrl}".`,
    );
  }

  return { serviceUrl, httpOrigin: `${protocol}//${url.host}`, serviceSecret };
}
