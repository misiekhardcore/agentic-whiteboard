import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The fixture is only useful if the app can talk to it, so this test starts the
 * real process and calls it the way the compatible client does: once without
 * streaming (titles) and once with it (the agent turn).
 */

let server: ChildProcess | undefined;
let baseURL = "";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`the scripted model never answered at ${url}`);
}

beforeAll(async () => {
  const port = await freePort();
  baseURL = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, ["scripts/scripted-model/server.mjs"], {
    env: { ...process.env, SCRIPTED_MODEL_PORT: String(port) },
    stdio: "ignore",
  });

  await waitForHealth(baseURL);
}, 20_000);

afterAll(() => {
  server?.kill("SIGTERM");
});

describe("the scripted model server", () => {
  it("answers a plain completion, as a title request does", async () => {
    const response = await fetch(`${baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "scripted-model",
        messages: [{ role: "user", content: "Plan the schema" }],
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    expect(body.choices[0].message.content).toBe("**Stub agent:** Plan the schema");
  });

  it("streams word deltas that rejoin to the same reply, then DONE", async () => {
    const response = await fetch(`${baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "scripted-model",
        stream: true,
        messages: [{ role: "user", content: "say hello there" }],
      }),
    });

    const text = await response.text();
    const frames = text
      .split("\n\n")
      .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
      .map(
        (line) =>
          JSON.parse(line.slice("data: ".length)) as {
            choices: { delta?: { content?: string } }[];
          },
      );

    const joined = frames
      .flatMap((frame) => frame.choices)
      .map((choice) => choice.delta?.content ?? "")
      .join("");

    expect(joined).toBe("**Stub agent:** say hello there");
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
    expect(frames.length).toBeGreaterThan(2);
  });
});
