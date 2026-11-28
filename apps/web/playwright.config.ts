import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";
import { loadEnvironment } from "@v2/config/env";

// Match the app: the root environment files supply local values, but variables
// already set (CI, or a one-off `DATABASE_URL=... pnpm test:e2e`) win.
loadEnvironment(fileURLToPath(new URL("../../", import.meta.url)));

const webPort = process.env.E2E_WEB_PORT ?? "3100";
const docPort = process.env.E2E_DOC_PORT ?? "3103";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${webPort}`;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:54322/agentic_whiteboard_v2";
const documentSecret = process.env.DOC_SERVICE_SECRET ?? "development-only-document-secret";
// Sandboxes without Playwright's system libraries can point at any Chromium.
const chromiumExecutable = process.env.E2E_CHROMIUM_EXECUTABLE;
const skipWebServer = Boolean(process.env.E2E_SKIP_WEB_SERVER);

const serviceEnv = {
  DATABASE_URL: databaseUrl,
  DOC_SERVICE_SECRET: documentSecret,
  DOC_SERVICE_URL: `ws://127.0.0.1:${docPort}`,
  DOC_SERVICE_INTERNAL_URL: `http://127.0.0.1:${docPort}`,
  DOC_PORT: docPort,
  // The e2e run signs up and signs in for real, so it needs the same auth
  // settings a deployment does; the value is a throwaway local secret.
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? "e2e-only-better-auth-secret-0123456789abcdef",
  WEB_URL: baseURL,
};

export default defineConfig({
  testDir: "./e2e",
  // The document room is shared state, so the specs run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable, args: ["--no-sandbox"] } }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "pnpm --filter @v2/collab exec tsx src/index.ts",
          url: `http://127.0.0.1:${docPort}/health`,
          env: serviceEnv,
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: `pnpm --filter @v2/web exec next dev --hostname 0.0.0.0 --port ${webPort}`,
          url: `${baseURL}/w/ws_demo`,
          env: serviceEnv,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ],
});
