import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { getProvider } from "@/lib/ai/providers/provider";

import { generateConversationTitle } from "./generateConversationTitle";

type Captured = { url: string; body: Record<string, unknown> };

let closeServer: (() => Promise<void>) | undefined;

/** A local stand-in for the provider, so the request shape can be inspected. */
async function captureRequest(captured: Captured): Promise<string> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      captured.url = request.url ?? "";
      captured.body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 0,
          model: captured.body.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Title: Schema planning" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  closeServer = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

  return `http://127.0.0.1:${port}/v1`;
}

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describe("naming a conversation on a dedicated model", () => {
  it("asks the provider not to reason, on the wire", async () => {
    const captured: Captured = { url: "", body: {} };
    const baseURL = await captureRequest(captured);
    const provider = getProvider({ provider: "groq", baseURL, apiKey: "test-key" });

    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: provider.languageModel("qwen/qwen3.8-27b"),
      maxRetries: 0,
      providerOptions: { groq: { reasoningEffort: "none" } },
    });

    expect(title).toBe("Schema planning");
    expect(captured.body.model).toBe("qwen/qwen3.8-27b");
    // The provider's option spelling is the request's snake_case field.
    expect(captured.body.reasoning_effort).toBe("none");
  });
});
