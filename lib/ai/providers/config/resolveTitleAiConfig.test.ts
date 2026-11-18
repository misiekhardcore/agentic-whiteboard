import { describe, expect, it } from "vitest";

import { AiConfigurationError } from "./AiConfigurationError";
import { resolveTitleAiConfig } from "./resolveTitleAiConfig";

describe("resolveTitleAiConfig", () => {
  it("is unused until a title model is chosen", () => {
    expect(resolveTitleAiConfig({})).toBeNull();
    expect(resolveTitleAiConfig({ AI_TITLE_PROVIDER: "groq" })).toBeNull();
  });

  it("names with Groq's qwen and turns its reasoning off", () => {
    expect(
      resolveTitleAiConfig({
        AI_TITLE_PROVIDER: "groq",
        AI_TITLE_MODEL: " qwen/qwen3.8-27b ",
        GROQ_API_KEY: "groq-key",
      }),
    ).toEqual({
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: "groq-key",
      // Naming must answer, not deliberate: qwen accepts "none" and every
      // token spent reasoning before a six-word name is wasted.
      reasoningEffort: "none",
    });
  });

  it("defaults to the provider the app already talks to", () => {
    expect(resolveTitleAiConfig({ AI_TITLE_MODEL: "local-small" })).toEqual({
      provider: "lmstudio",
      model: "local-small",
      baseURL: "http://127.0.0.1:1234/v1",
      apiKey: "lm-studio",
      reasoningEffort: "none",
    });
  });

  it("prefers a title-specific key over the provider's shared key", () => {
    const config = resolveTitleAiConfig({
      AI_TITLE_PROVIDER: "groq",
      AI_TITLE_MODEL: "qwen/qwen3.8-27b",
      AI_TITLE_API_KEY: "title-key",
      GROQ_API_KEY: "shared-key",
    });

    expect(config?.apiKey).toBe("title-key");
  });

  it("rejects an unknown title provider and names the supported ids", () => {
    expect(() =>
      resolveTitleAiConfig({ AI_TITLE_PROVIDER: "anthropic", AI_TITLE_MODEL: "claude" }),
    ).toThrow(AiConfigurationError);
    expect(() =>
      resolveTitleAiConfig({ AI_TITLE_PROVIDER: "anthropic", AI_TITLE_MODEL: "claude" }),
    ).toThrow(/Unknown AI_TITLE_PROVIDER "anthropic".*lmstudio/);
  });

  it("requires a base URL when the title provider has no default", () => {
    expect(() =>
      resolveTitleAiConfig({
        AI_TITLE_PROVIDER: "openai-compatible",
        AI_TITLE_MODEL: "some-model",
      }),
    ).toThrow(/AI_TITLE_BASE_URL is required/);
  });
});
