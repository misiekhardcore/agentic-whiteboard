import { generateText, jsonSchema, tool } from "ai";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAgent } from "./agent";
import { getAiConfig } from "./config";
import { getLanguageModel } from "./provider";

type ChatMessage = {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
};

type ChatRequestBody = {
  model?: string;
  messages?: ChatMessage[];
};

type CapturedRequest = {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: ChatRequestBody;
};

type Completion = Record<string, unknown>;

let closeServer: (() => Promise<void>) | undefined;

function textCompletion(text: string): Completion {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "lmstudio-test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  };
}

function toolCallCompletion(): Completion {
  return {
    id: "chatcmpl-tool",
    object: "chat.completion",
    created: 0,
    model: "lmstudio-test-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "lookup",
                arguments: JSON.stringify({ query: "hello" }),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

async function startServer(respond: (request: CapturedRequest, index: number) => Completion) {
  const requests: CapturedRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const captured: CapturedRequest = {
        url: request.url ?? "",
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as ChatRequestBody,
      };
      requests.push(captured);

      if (request.method !== "POST" || captured.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(respond(captured, requests.length - 1)));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseURL: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "lmstudio");
  vi.stubEnv("AI_MODEL", "lmstudio-test-model");
  vi.stubEnv("AI_API_KEY", "local-test-key");
  vi.stubEnv("AI_MAX_RETRIES", "0");
});

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
  vi.unstubAllEnvs();
});

describe("LM Studio OpenAI-compatible path", () => {
  it("sends an env-configured generateText request over HTTP", async () => {
    const { baseURL, requests, close } = await startServer(() =>
      textCompletion("LM Studio says hi"),
    );
    closeServer = close;
    vi.stubEnv("AI_BASE_URL", baseURL);

    const config = getAiConfig();
    expect(config).toMatchObject({
      provider: "lmstudio",
      baseURL,
      model: "lmstudio-test-model",
      apiKey: "local-test-key",
    });

    const result = await generateText({
      model: getLanguageModel(config),
      prompt: "Say hi",
      maxRetries: 0,
    });

    expect(result.text).toBe("LM Studio says hi");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("/v1/chat/completions");
    expect(requests[0].body.model).toBe("lmstudio-test-model");
    expect(requests[0].headers.authorization).toBe("Bearer local-test-key");
  });

  it("runs the agent tool loop against the same HTTP surface", async () => {
    const { baseURL, requests, close } = await startServer((_request, index) =>
      index === 0 ? toolCallCompletion() : textCompletion("The tool returned echo:hello"),
    );
    closeServer = close;
    vi.stubEnv("AI_BASE_URL", baseURL);

    const agent = createAgent({
      tools: {
        lookup: tool({
          description: "Echo a query back to the model",
          inputSchema: jsonSchema<{ query: string }>({
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          }),
          execute: ({ query }) => ({ answer: `echo:${query}` }),
        }),
      },
      maxSteps: 3,
      maxRetries: 0,
    });

    const result = await agent.generate({ prompt: "Look up hello" });

    expect(result.text).toBe("The tool returned echo:hello");
    expect(requests).toHaveLength(2);
    expect(requests[1].body.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "tool", tool_call_id: "call_1" })]),
    );
    expect(JSON.stringify(requests[1].body.messages)).toContain("echo:hello");
  });
});
