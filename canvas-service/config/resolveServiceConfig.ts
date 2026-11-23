import { ServiceConfigurationError } from "./ServiceConfigurationError";
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
  const serviceSecret = env.CANVAS_SERVICE_SECRET?.trim();
  if (!serviceSecret) {
    throw new ServiceConfigurationError(
      "CANVAS_SERVICE_SECRET is required: it signs connection tokens and authenticates the service to the app.",
    );
  }

  const rawPort = env.CANVAS_SERVICE_PORT?.trim();
  const port = rawPort ? Number(rawPort) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ServiceConfigurationError(
      `CANVAS_SERVICE_PORT must be a port number, received "${rawPort}".`,
    );
  }

  const appUrl = (env.CANVAS_APP_INTERNAL_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
  if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
    throw new ServiceConfigurationError(
      `CANVAS_APP_INTERNAL_URL must be the app's http(s) origin, received "${appUrl}".`,
    );
  }

  return { port, serviceSecret, appUrl };
}
