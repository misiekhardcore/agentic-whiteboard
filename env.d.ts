declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    NEXT_PUBLIC_BASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    AI_PROVIDER: string;
    AI_MODEL: string;
    AI_BASE_URL: string;
    AI_API_KEY: string;
    AI_MAX_STEPS: string;
    AI_MAX_RETRIES: string;
    STRIPE_SECRET_KEY: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
  }
}
