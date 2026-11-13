import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The tests read the same environment the app does, so a local run needs no
// extra setup beyond `.env.local`. Variables already set (CI) win.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // One browser at a time: the billing flow talks to a real Stripe test account
  // and asserts on rows written by the webhook.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // CI starts the production server itself (with the Stripe CLI's signing
  // secret) and sets E2E_SKIP_WEB_SERVER. Locally this reuses a running dev
  // server, or starts one.
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined      : {
        command: "pnpm dev",
        // The prompt specs drive the agent, so they need the scripted provider
        // rather than whatever `.env.local` points at. Running the app with
        // your own server (`E2E_SKIP_WEB_SERVER`) means supplying these too.
        env: {
          PORT: new URL(baseURL).port || "3000",
          AI_PROVIDER: "stub",
          AI_MODEL: "stub-model",
        },
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
