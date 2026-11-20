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
  }
}
