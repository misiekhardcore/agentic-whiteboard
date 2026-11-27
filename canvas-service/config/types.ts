export type CanvasServiceConfig = {
  /** The port the process listens on. */
  port: number;
  /** Authenticates the service to the app and signs browser connection tokens. */
  serviceSecret: string;
  /** The app's own origin, which serves the snapshot route. */
  appUrl: string;
  /** Where each canvas keeps its SQLite working store. */
  roomsDirectory: string;
};

/** The settings this process reads, all optional so a test can leave one out. */
export type CanvasServiceEnvironment = {
  CANVAS_SERVICE_PORT?: string;
  CANVAS_SERVICE_SECRET?: string;
  CANVAS_APP_INTERNAL_URL?: string;
  CANVAS_ROOMS_DIR?: string;
};
