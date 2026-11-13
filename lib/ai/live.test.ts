import { generateText, jsonSchema, tool } from "ai";
import { config as loadEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

import { createAgent } from "./agent";
import { type AiConfig, getAiConfig } from "./config";
import { getLanguageModel } from "./provider";

/**
 * Live smoke test against whatever provider `.env` configures — LM Studio by
 * default. It is skipped unless AI_LIVE is set so the regular suite needs no
 * server; run it with `pnpm test:ai`.
 *
 * Expects LM Studio's local server to be running with a chat model loaded and
 * AI_MODEL set to that model's id.
 */
const live = process.env.AI_LIVE === "1";

describe.skipIf(!live)("live AI provider", () => {
  let config: AiConfig;

  beforeAll(async () => {
    loadEnv({ quiet: true });
    config = getAiConfig();

    try {
      await fetch(`${config.baseURL}/models`);
    } catch {
      throw new Error(
        `No server answered at ${config.baseURL}. Start LM Studio's local server with a model loaded, or point AI_BASE_URL at your endpoint.`,
      );
    }
  });

  it("answers a prompt through the configured provider", async () => {
    const result = await generateText({
      model: getLanguageModel(config),
      prompt: "Reply with exactly one word: pong",
      maxRetries: 0,
    });

    expect(result.text.trim().length).toBeGreaterThan(0);
  }, 180_000);

  it("runs a tool through the agent loop", async () => {
    let toolRan = false;

    const agent = createAgent({
      tools: {
        add: tool({
          description: "Add two numbers and return their sum.",
          inputSchema: jsonSchema<{ a: number; b: number }>({
            type: "object",
            properties: { a: { type: "number" }, b: { type: "number" } },
            required: ["a", "b"],
            additionalProperties: false,
          }),
          execute: ({ a, b }) => {
            toolRan = true;
            return { sum: a + b };
          },
        }),
      },
      maxSteps: 3,
      maxRetries: 0,
    });

    const result = await agent.generate({
      prompt: "Call the add tool with a=19 and b=23, then reply with only the sum.",
    });

    expect(toolRan).toBe(true);
    expect(result.text).toContain("42");
  }, 180_000);
});
