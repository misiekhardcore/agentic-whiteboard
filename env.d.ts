declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    NEXT_PUBLIC_BASE_URL: string;
    AUTH_HAS_CREDENTIALS: 'true' | 'false';
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    AUTH_GITHUB_ID: string;
    AUTH_GITHUB_SECRET: string;
    AUTH_GOOGLE_ID: string;
    AUTH_GOOGLE_SECRET: string;
  }
}
