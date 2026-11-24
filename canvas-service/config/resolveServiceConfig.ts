import { ConfigurationError, environmentReader } from "@/lib/shared/env";

import type { CanvasServiceConfig, CanvasServiceEnvironment } from "./types";

const DEFAULT_PORT = 4100;
const DEFAULT_APP_URL = "http://localhost:3000";

/**
 * The service has no safe defaults for its secret: without one it cannot tell
 * a browser token from a forgery or authenticate itself to the app, so the
 * process refuses to start rather than run open.
 */
export function resolveServiceConfig(
  env: CanvasServiceEnvironment = process.env,
): CanvasServiceConfig {
  const read = environmentReader(env);
  const serviceSecret = read.value("CANVAS_SERVICE_SECRET");
  if (!serviceSecret) {
    throw new ConfigurationError(
      "CANVAS_SERVICE_SECRET is required: it signs connection tokens and authenticates the service to the app.",
    );
  }

  return {
    port: read.port("CANVAS_SERVICE_PORT", DEFAULT_PORT),
    serviceSecret,
    appUrl: read.origin("CANVAS_APP_INTERNAL_URL") ?? DEFAULT_APP_URL,
  };
}
