import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelConnection } from "./config";
import { AI_PROVIDER_NAME, createModel, TITLE_PROVIDER_OPTIONS } from "./model";

type CapturedRequest = {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
};

const connection: ModelConnection = {
  baseURL: "https://endpoint.test/v1",
  apiKey: "test-key",
  model: "local/test-model",
  stub: false,
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
        model: connection.model,
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

describe("createModel", () => {
  it("sends generation to the configured endpoint with its key", async () => {
    const requests: CapturedRequest[] = [];
    stubCompletion(requests);

    const result = await generateText({
      model: createModel(connection),
      prompt: "Say OK",
      maxRetries: 0,
    });

    expect(result.text).toBe("OK");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://endpoint.test/v1/chat/completions");
    expect(requests[0].body.model).toBe("local/test-model");
    expect(requests[0].headers.get("authorization")).toBe("Bearer test-key");
  });

  it("answers from the scripted provider without a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateText({
      model: createModel({ ...connection, stub: true }),
      prompt: "Say OK",
      maxRetries: 0,
    });

    // Non-streaming generation on the stub answers as a naming request would,
    // which is what the title path uses it for in e2e.
    expect(result.text).toContain("Stub title:");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps the title provider options onto the request's reasoning field", async () => {
    const requests: CapturedRequest[] = [];
    stubCompletion(requests);

    await generateText({
      model: createModel(connection),
      prompt: "Say OK",
      maxRetries: 0,
      providerOptions: TITLE_PROVIDER_OPTIONS,
    });

    expect(AI_PROVIDER_NAME).toBe("ai");
    expect(requests[0].body.reasoning_effort).toBe("none");
  });
});
