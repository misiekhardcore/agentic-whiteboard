import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { requestConversationTitle } from "./requestConversationTitle";
import { TITLE_INSTRUCTION } from "./titleRequest";

const config = {
  baseURL: "https://titler.example.test/v1",
  apiKey: "secret-key",
  model: "some-small-model",
};

type Captured = { system?: string; prompt?: string; providerOptions?: unknown };

function modelReturning(text: string, captured: Captured[] = []) {
  return new MockLanguageModelV4({
    doGenerate: (options) => {
      const textOf = (role: string) => {
        const content = options.prompt.find((message) => message.role === role)?.content;
        if (typeof content === "string") return content;
        return (content ?? [])
          .flatMap((part) =>
            typeof part === "object" && "text" in part ? [String(part.text)] : [],
          )
          .join("");
      };

      captured.push({
        system: textOf("system"),
        prompt: textOf("user"),
        providerOptions: options.providerOptions,
      });

      return Promise.resolve({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 2, text: 2, reasoning: 0 },
        },
        warnings: [],
      });
    },
  });
}

describe("requestConversationTitle", () => {
  it("asks the marked question about the prompt and returns a cleaned title", async () => {
    const captured: Captured[] = [];
    const title = await requestConversationTitle({
      source: "Plan the schema",
      config,
      model: modelReturning('Title: "Schema plan"', captured),
    });

    expect(title).toBe("Schema plan");
    expect(captured[0].system).toContain(TITLE_INSTRUCTION);
    expect(captured[0].prompt).toBe("Plan the schema");
  });

  it("sends the reasoning mode only when the deployment configured one", async () => {
    const without = await requestConversationTitle({
      source: "Plan the schema",
      config,
      model: modelReturning("Schema plan"),
    });
    expect(without).toBe("Schema plan");

    const captured: Captured[] = [];
    await requestConversationTitle({
      source: "Plan the schema",
      config: { ...config, reasoningEffort: "none" },
      model: modelReturning("Schema plan", captured),
    });

    expect(captured[0].providerOptions).toEqual({ title: { reasoningEffort: "none" } });
  });

  it("returns null when the answer is unusable", async () => {
    expect(
      await requestConversationTitle({
        source: "Plan the schema",
        config,
        model: modelReturning("   "),
      }),
    ).toBeNull();
  });
});
