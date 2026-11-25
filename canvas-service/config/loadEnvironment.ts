import dotenv from "dotenv";

/**
 * Next reads both files; the service does too, so `pnpm canvas:dev` works from a
 * checkout configured with either one. Values already in the environment
 * (docker compose, Playwright) win.
 */
export function loadEnvironment(): void {
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
}
