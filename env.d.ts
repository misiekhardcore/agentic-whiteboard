declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    NEXT_PUBLIC_BASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    AI_MODEL?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
    AI_MAX_STEPS?: string;
    AI_MAX_RETRIES?: string;
    AI_TOOL_APPROVAL_SECRET?: string;
    TITLE_AI_BASE_URL?: string;
    TITLE_AI_API_KEY?: string;
    TITLE_AI_MODEL?: string;
    TITLE_AI_REASONING_EFFORT?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    JWT_SECRET?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    STRIPE_SECRET_KEY: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    STRIPE_WEBHOOK_SECRET?: string;
    /** Where the browser reaches the canvas sync service; unset disables the canvas. */
    NEXT_PUBLIC_CANVAS_SERVICE_URL?: string;
    /** Shared with the canvas service: signs connection tokens and authenticates its calls. */
    CANVAS_SERVICE_SECRET?: string;
    /** The port the canvas service listens on. */
    CANVAS_SERVICE_PORT?: string;
    /** The app's own origin, which the canvas service calls for snapshots. */
    CANVAS_APP_INTERNAL_URL?: string;
    /** tldraw's production licence; without one the editor carries a watermark. */
    NEXT_PUBLIC_TLDRAW_LICENSE_KEY?: string;
    /** The Storage bucket stored media lives in; defaults to `media`. */
    MEDIA_BUCKET?: string;
  }
}
