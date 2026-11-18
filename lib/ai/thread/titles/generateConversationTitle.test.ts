import type { LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { TITLE_OUTPUT_TOKENS } from "./constants";
import { generateConversationTitle } from "./generateConversationTitle";

const USAGE = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 4, text: 4, reasoning: 0 },
};

function modelReturning(text: string, onPrompt?: (prompt: unknown) => void): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: (options) => {
      onPrompt?.(options.prompt);
      return Promise.resolve({
        content: [{ type: "text" as const, text }],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: USAGE,
        warnings: [],
      });
    },
  });
}

describe("generateConversationTitle", () => {
  it("normalises the model's reply into a name", async () => {
    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning('Title: "Schema planning."'),
      maxRetries: 0,
    });

    expect(title).toBe("Schema planning");
  });

  it("has no title when the model answered with nothing", async () => {
    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning("   "),
      maxRetries: 0,
    });

    expect(title).toBeNull();
  });

  it("has no title when the model answered instead of naming the conversation", async () => {
    const title = await generateConversationTitle({
      prompt: "Plan the database schema",
      model: modelReturning("I cannot answer that question as asked."),
      maxRetries: 0,
    });

    expect(title).toBeNull();
  });

  it("leaves a reasoning model room to answer inside the output budget", async () => {
    let maxOutputTokens: number | undefined;

    await generateConversationTitle({
      prompt: "Plan the database schema",
      model: new MockLanguageModelV4({
        doGenerate: (options) => {
          maxOutputTokens = options.maxOutputTokens;
          return Promise.resolve({
            content: [{ type: "text" as const, text: "Title: Schema planning" }],
            finishReason: { unified: "stop" as const, raw: "stop" },
            usage: USAGE,
            warnings: [],
          });
        },
      }),
      maxRetries: 0,
    });

    // A model that reasons before answering spends part of this budget on that
    // reasoning; a title-sized cap makes it return no text at all.
    expect(maxOutputTokens).toBe(TITLE_OUTPUT_TOKENS);
    expect(maxOutputTokens).toBeGreaterThanOrEqual(256);
  });

  it("sends the caller's provider options, so naming can turn reasoning off", async () => {
    let sent: unknown;

    await generateConversationTitle({
      prompt: "Plan the database schema",
      model: new MockLanguageModelV4({
        doGenerate: (options) => {
          sent = options.providerOptions;
          return Promise.resolve({
            content: [{ type: "text" as const, text: "Title: Schema planning" }],
            finishReason: { unified: "stop" as const, raw: "stop" },
            usage: USAGE,
            warnings: [],
          });
        },
      }),
      maxRetries: 0,
      providerOptions: { groq: { reasoningEffort: "none" } },
    });

    expect(sent).toEqual({ groq: { reasoningEffort: "none" } });
  });

  it("names the conversation from the prompt, bounded to what the model needs", async () => {
    let sent: unknown;
    await generateConversationTitle({
      prompt: "x".repeat(5000),
      model: modelReturning("Title", (prompt) => {
        sent = prompt;
      }),
      maxRetries: 0,
    });

    // Either shape the SDK may hand the model: the point is that a huge prompt
    // is not resent in full just to name the conversation.
    expect(JSON.stringify(sent)).not.toContain("x".repeat(2001));
  });
});
