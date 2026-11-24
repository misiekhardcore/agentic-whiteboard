/** Where the browser reaches the canvas service, and the secret the app shares with it. */
export type CanvasConfig = {
  /** The service's browser-facing origin, `ws://` or `wss://`, without a path. */
  serviceUrl: string;
  /** The same service over HTTP, for its health read and its revoke call. */
  httpOrigin: string;
  /** Authenticates the service's internal calls and signs connection tokens. */
  serviceSecret: string;
};

export type CanvasEnvironment = Pick<
  typeof process.env,
  "NEXT_PUBLIC_CANVAS_SERVICE_URL" | "CANVAS_SERVICE_SECRET"
>;
