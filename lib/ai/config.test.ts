import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AiConfigurationError,
  isAiConfigured,
  resolveAiConfig,
} from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAiConfig", () => {
  it("defaults to LM Studio and trims the model id", () => {
    expect(resolveAiConfig({ AI_MODEL: "  qwen/qwen3-4b  " })).toEqual({
      provider: "lmstudio",
      model: "qwen/qwen3-4b",
      baseURL: "http://127.0.0.1:1234/v1",
      apiKey: "lm-studio",
      maxSteps: 20,
      maxRetries: 0,
    });
  });

  it("accepts a generic OpenAI-compatible endpoint without a trailing slash", () => {
    expect(
      resolveAiConfig({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "openai/gpt-oss-20b",
        AI_BASE_URL: "https://openrouter.ai/api/v1/",
        AI_API_KEY: "secret",
        AI_MAX_STEPS: "8",
        AI_MAX_RETRIES: "3",
      }),
    ).toEqual({
      provider: "openai-compatible",
      model: "openai/gpt-oss-20b",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "secret",
      maxSteps: 8,
      maxRetries: 3,
    });
  });

  it("allows an API key override for LM Studio auth", () => {
    expect(
      resolveAiConfig({ AI_MODEL: "local", AI_API_KEY: "token" }).apiKey,
    ).toBe("token");
  });

  it("requires a model id and explains how to find one", () => {
    expect(() => resolveAiConfig({})).toThrow(AiConfigurationError);
    expect(() => resolveAiConfig({})).toThrow(/\/v1\/models/);
  });

  it("rejects unknown providers and lists the supported ids", () => {
    expect(() =>
      resolveAiConfig({ AI_PROVIDER: "anthropic", AI_MODEL: "claude" }),
    ).toThrow(/Unknown AI_PROVIDER "anthropic".*lmstudio, openai-compatible/);
  });

  it("accepts the scripted stub provider used by the e2e suite", () => {
    expect(resolveAiConfig({ AI_PROVIDER: "stub", AI_MODEL: "stub-model" }))
      .toEqual({
        provider: "stub",
        model: "stub-model",
        baseURL: "stub://local",
        apiKey: "stub",
        maxSteps: 20,
        maxRetries: 0,
      });
  });

  it("requires a base URL for a generic compatible endpoint", () => {
    expect(() =>
      resolveAiConfig({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "some-model",
      }),
    ).toThrow(/AI_BASE_URL is required/);
  });

  it("validates step and retry limits", () => {
    expect(() =>
      resolveAiConfig({ AI_MODEL: "local", AI_MAX_STEPS: "0" }),
    ).toThrow(/AI_MAX_STEPS must be a whole number/);
    expect(() =>
      resolveAiConfig({ AI_MODEL: "local", AI_MAX_STEPS: "2.5" }),
    ).toThrow(/AI_MAX_STEPS must be a whole number/);
    expect(() =>
      resolveAiConfig({ AI_MODEL: "local", AI_MAX_RETRIES: "-1" }),
    ).toThrow(/AI_MAX_RETRIES must be a whole number/);
  });
});

describe("isAiConfigured", () => {
  it("is false without a model and true with a valid configuration", () => {
    vi.stubEnv("AI_MODEL", "");
    expect(isAiConfigured()).toBe(false);

    vi.stubEnv("AI_MODEL", "local-model");
    expect(isAiConfigured()).toBe(true);
  });
});
