import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAgent,
  DEFAULT_AGENT_INSTRUCTIONS,
} from "./agent";

type ChatMessage = {
  role: string;
  content: string;
};

function stubCompletion(messages: ChatMessage[][]) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as { messages?: ChatMessage[] })
          : {};
      messages.push(body.messages ?? []);

      return new Response(
        JSON.stringify({
          id: "chatcmpl-agent-test",
          object: "chat.completion",
          created: 0,
          model: "agent-test",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  );

  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "lmstudio");
  vi.stubEnv("AI_MODEL", "agent-test");
  vi.stubEnv("AI_BASE_URL", "http://127.0.0.1:9877/v1");
  vi.stubEnv("AI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createAgent", () => {
  it("applies custom instructions and runs without tools", async () => {
    const requests: ChatMessage[][] = [];
    stubCompletion(requests);

    const agent = createAgent({
      instructions: "CUSTOM AGENT INSTRUCTIONS",
      maxSteps: 3,
      maxRetries: 0,
    });

    const result = await agent.generate({ prompt: "Hello" });

    expect(agent.tools).toEqual({});
    expect(result.text).toBe("Hello");
    expect(requests).toHaveLength(1);
    expect(requests[0][0]).toMatchObject({
      role: "system",
      content: "CUSTOM AGENT INSTRUCTIONS",
    });
  });

  it("falls back to the shared instructions", async () => {
    const requests: ChatMessage[][] = [];
    stubCompletion(requests);

    await createAgent({ maxRetries: 0 }).generate({ prompt: "Hello" });

    expect(requests[0][0]).toMatchObject({
      role: "system",
      content: DEFAULT_AGENT_INSTRUCTIONS,
    });
  });

  it("runs with an explicit model when no provider env is configured", async () => {
    // Invalid values prove createAgent does not resolve env config at all on
    // the explicit-model path.
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MAX_STEPS", "not-a-number");
    vi.stubEnv("AI_MAX_RETRIES", "not-a-number");

    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "mock reply" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: {
            total: 3,
            noCache: 3,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: { total: 2, text: 2, reasoning: 0 },
        },
        warnings: [],
      }),
    });

    const result = await createAgent({ model, maxRetries: 0 }).generate({
      prompt: "Hello",
    });

    expect(result.text).toBe("mock reply");
  });
});
