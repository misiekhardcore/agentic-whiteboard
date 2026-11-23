export type CanvasServiceConfig = {
  /** The port the process listens on. */
  port: number;
  /** Authenticates the service to the app and signs browser connection tokens. */
  serviceSecret: string;
  /** The app's own origin, which serves the snapshot route. */
  appUrl: string;
};

export type CanvasServiceEnvironment = Pick<
  typeof process.env,
  "CANVAS_SERVICE_PORT" | "CANVAS_SERVICE_SECRET" | "CANVAS_APP_INTERNAL_URL"
>;
