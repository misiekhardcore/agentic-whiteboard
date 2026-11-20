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
const scriptedModelPort = process.env.SCRIPTED_MODEL_PORT ?? "3311";
const scriptedModelUrl = `http://127.0.0.1:${scriptedModelPort}`;
const broadcastSinkPort = process.env.BROADCAST_SINK_PORT ?? "3312";
const broadcastSinkUrl = `http://127.0.0.1:${broadcastSinkPort}`;

// The main suite records what the app publishes in a sink, so it can assert the
// publication without a stack. `REALTIME_E2E=1` runs the other half instead: the
// app is pointed at a real stack (`pnpm db:up`) and only the spec that reads a
// change over an actual socket runs, because the sink-backed specs assert on the
// sink.
const realtime = Boolean(process.env.REALTIME_E2E);

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
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: realtime ? /realtime\.spec\.ts$/ : undefined,
      testIgnore: realtime ? undefined : /realtime\.spec\.ts$/,
    },
  ],
  // CI starts the production server itself (with the Stripe CLI's signing
  // secret) and sets E2E_SKIP_WEB_SERVER. Locally Playwright starts both its
  // own app server on `E2E_PORT` (default :3100) and the scripted model, so
  // `pnpm dev` must be stopped first.
  webServer: skipWebServer
    ? undefined
    : [
        ...(realtime
          ? []
          : [
              {
                // Records what the app publishes for the change channels, so a
                // spec can assert a capability's keys left the server without
                // the Supabase stack running on this machine.
                command: "node scripts/broadcast-sink.mjs",
                env: { BROADCAST_SINK_PORT: broadcastSinkPort },
                url: `${broadcastSinkUrl}/health`,
                reuseExistingServer: true,
                timeout: 30_000,
              },
            ]),
        {
          // The app has one provider path: HTTP chat completions. The suite
          // points it at a scripted endpoint instead of shipping a fake model.
          command: "node scripts/scripted-model/server.mjs",
          env: {
            SCRIPTED_MODEL_PORT: scriptedModelPort,
            // Hold the first chunk back so a spec can act while a reply is
            // still streaming; the scripted endpoint is otherwise instant.
            SCRIPTED_DELAY_MS: process.env.SCRIPTED_DELAY_MS ?? "1500",
            // The script emits a word per chunk. A gap between them leaves time
            // to observe a reply (and the speech it drives) mid-flight.
            SCRIPTED_CHUNK_DELAY_MS: process.env.SCRIPTED_CHUNK_DELAY_MS ?? "120",
          },
          url: `${scriptedModelUrl}/health`,
          reuseExistingServer: true,
          timeout: 30_000,
        },
        {
          command: "pnpm dev",
          // Running the app with your own server (`E2E_SKIP_WEB_SERVER`) means
          // supplying these values too.
          env: {
            PORT: new URL(baseURL).port || "3000",
            AI_BASE_URL: `${scriptedModelUrl}/v1`,
            AI_API_KEY: "scripted",
            AI_MODEL: "scripted-model",
            TITLE_AI_BASE_URL: `${scriptedModelUrl}/v1`,
            TITLE_AI_API_KEY: "scripted",
            TITLE_AI_MODEL: "scripted-model",
            // Every change broadcast goes to the sink instead of a stack, so
            // the specs assert on the publication itself and never depend on a
            // Realtime container being up. `SUPABASE_URL` is read only for
            // this; the browser's stack address is NEXT_PUBLIC_SUPABASE_URL.
            // A realtime run inherits the stack it was configured with.
            ...(realtime
              ? {}
              : {
                  SUPABASE_URL: broadcastSinkUrl,
                  SUPABASE_SERVICE_ROLE_KEY: "scripted-service-role",
                }),
            // The approval specs need signed requests; a fixed test value is
            // enough because the scripted endpoint never leaves the machine.
            AI_TOOL_APPROVAL_SECRET:
              process.env.AI_TOOL_APPROVAL_SECRET ?? "e2e-tool-approval-secret-0123456789abcdef",
          },
          url: baseURL,
          // Never reuse: a server someone already has open runs whatever
          // endpoint their environment selects, and the prompt specs need the
          // scripted one. Next allows a single dev server per project
          // directory, so `pnpm dev` being up makes this fail with its own
          // message naming the process to stop — better than the specs quietly
          // driving a real model.
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
});
