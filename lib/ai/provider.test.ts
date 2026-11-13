import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiConfig } from "./config";
import { getLanguageModel, getProvider } from "./provider";

type CapturedRequest = {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
};

const config: AiConfig = {
  provider: "lmstudio",
  model: "local/test-model",
  baseURL: "http://127.0.0.1:9876/v1",
  apiKey: "test-key",
  maxSteps: 20,
  maxRetries: 0,
};

function stubCompletion(requests: CapturedRequest[]) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    requests.push({
      url,
      body:
        typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {},
      headers: new Headers(init?.headers),
    });

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: config.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "OK" },
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
  });

  vi.stubGlobal("fetch", fetchMock);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getLanguageModel", () => {
  it("sends generation to the configured compatible endpoint", async () => {
    const requests: CapturedRequest[] = [];
    stubCompletion(requests);

    const result = await generateText({
      model: getLanguageModel(config),
      prompt: "Say OK",
      maxRetries: 0,
    });

    expect(result.text).toBe("OK");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("http://127.0.0.1:9876/v1/chat/completions");
    expect(requests[0].body.model).toBe("local/test-model");
    expect(requests[0].headers.get("authorization")).toBe("Bearer test-key");
  });

  it("reuses the provider instance for the same connection", () => {
    expect(getProvider(config)).toBe(getProvider(config));
  });
});
