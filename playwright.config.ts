import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// The tests read the same environment the app does, so a local run needs no
// extra setup beyond `.env.local`. Variables already set (CI) win.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

// The suite needs the scripted provider, so the server it starts must not share
// a port with the developer's own `pnpm dev`: reusing that server would run the
// specs against the wrong provider, and a leftover one would answer the real
// app with stub replies that never reach the model. CI supplies its own server
// (`E2E_SKIP_WEB_SERVER`), which keeps the conventional :3000 there.
const skipWebServer = Boolean(process.env.E2E_SKIP_WEB_SERVER);
const ownServerPort = process.env.E2E_PORT ?? "3100";
const baseURL =
  process.env.E2E_BASE_URL ?? `http://localhost:${skipWebServer ? "3000" : ownServerPort}`;

export default defineConfig({
  testDir: "./e2e",
  // One browser at a time: the billing flow talks to a real Stripe test account
  // and asserts on rows written by the webhook.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // CI starts the production server itself (with the Stripe CLI's signing
  // secret) and sets E2E_SKIP_WEB_SERVER. Locally Playwright starts its own
  // server on `E2E_PORT` (default :3100), so `pnpm dev` must be stopped first.
  webServer: skipWebServer
    ? undefined
    : {
        command: "pnpm dev",
        // The prompt specs drive the agent, so they need the scripted provider
        // rather than whatever `.env.local` points at. Running the app with
        // your own server (`E2E_SKIP_WEB_SERVER`) means supplying these too.
        env: {
          PORT: new URL(baseURL).port || "3000",
          AI_PROVIDER: "stub",
          AI_MODEL: "stub-model",
          // Hold the first chunk back so a spec can act while a reply is still
          // streaming; the scripted provider is otherwise instantaneous.
          AI_STUB_DELAY_MS: process.env.AI_STUB_DELAY_MS ?? "1500",
          // The approval specs need signed requests; a fixed test value is
          // enough because the stub never leaves the machine.
          AI_TOOL_APPROVAL_SECRET:
            process.env.AI_TOOL_APPROVAL_SECRET ?? "e2e-tool-approval-secret-0123456789abcdef",
        },
        url: baseURL,
        // Never reuse: a server someone already has open runs whatever provider
        // their environment selects, and the prompt specs need the scripted one.
        // Next allows a single dev server per project directory, so `pnpm dev`
        // being up makes this fail with its own message naming the process to
        // stop — better than the specs quietly driving the real model.
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
