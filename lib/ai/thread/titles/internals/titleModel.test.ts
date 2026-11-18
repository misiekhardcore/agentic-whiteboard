import { afterEach, describe, expect, it, vi } from "vitest";

import { titleModel } from "./titleModel";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the model that names conversations", () => {
  it("uses the dedicated title model and turns its reasoning off", () => {
    vi.stubEnv("AI_TITLE_PROVIDER", "groq");
    vi.stubEnv("AI_TITLE_MODEL", "qwen/qwen3.8-27b");
    vi.stubEnv("AI_TITLE_API_KEY", "groq-key");
    vi.stubEnv("AI_PROVIDER", "lmstudio");
    vi.stubEnv("AI_MODEL", "qwen3.5-9b-claude-4.6-opus-reasoning-distilled");

    const resolved = titleModel();

    expect(resolved?.providerOptions).toEqual({ groq: { reasoningEffort: "none" } });
    // A name is rescheduled by the next prompt, so a bad minute must not be
    // retried into the turn that triggered it.
    expect(resolved?.maxRetries).toBe(0);
  });

  it("falls back to the agent's own model, without a reasoning setting", () => {
    vi.stubEnv("AI_TITLE_MODEL", "");
    vi.stubEnv("AI_PROVIDER", "lmstudio");
    vi.stubEnv("AI_MODEL", "qwen3.5-9b-claude-4.6-opus-reasoning-distilled");

    const resolved = titleModel();

    // The agent's model keeps its configured retries and is never told what to
    // do about reasoning: not every provider accepts that field.
    expect(resolved?.providerOptions).toBeUndefined();
    expect(resolved?.maxRetries).toBe(0);
  });

  it("skips naming, without throwing, when no model is configured", () => {
    vi.stubEnv("AI_TITLE_MODEL", "");
    vi.stubEnv("AI_MODEL", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(titleModel()).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});
