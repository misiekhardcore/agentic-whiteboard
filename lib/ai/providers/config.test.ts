import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AiConfigurationError,
  isAiConfigured,
  modelSource,
  resolveAiConfig,
  resolveTitleAiConfig,
} from "./config";

/** Every required variable for the agent; AI_STUB is a switch, not one of them. */
const complete = {
  AI_BASE_URL: "https://endpoint.test/openai/v1/",
  AI_API_KEY: " agent-key ",
  AI_MODEL: " agent-model ",
  AI_MAX_STEPS: "20",
  AI_MAX_RETRIES: "0",
};

const completeTitle = {
  AI_TITLE_BASE_URL: "https://names.test/openai/v1",
  AI_TITLE_API_KEY: "title-key",
  AI_TITLE_MODEL: "qwen/qwen3.8-27b",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAiConfig", () => {
  it("reads the connection from the environment, trimmed and without a trailing slash", () => {
    expect(resolveAiConfig(complete)).toEqual({
      baseURL: "https://endpoint.test/openai/v1",
      apiKey: "agent-key",
      model: "agent-model",
      stub: false,
      maxSteps: 20,
      maxRetries: 0,
    });
  });

  it("has no defaults: an empty environment names every missing connection variable", () => {
    expect(() => resolveAiConfig({})).toThrow(AiConfigurationError);
    expect(() => resolveAiConfig({})).toThrow(
      /AI is not configured: set AI_BASE_URL, AI_API_KEY, AI_MODEL, AI_MAX_STEPS, AI_MAX_RETRIES/,
    );
  });

  it("names only what is actually missing", () => {
    expect(() => resolveAiConfig({ ...complete, AI_MODEL: "  " })).toThrow(
      /AI is not configured: set AI_MODEL\./,
    );
  });

  it("says which model settings are required, not what the app would have used", () => {
    expect(() => resolveAiConfig({ AI_BASE_URL: "", AI_API_KEY: "", AI_MODEL: "" })).toThrow(
      /There are no defaults; every model setting comes from the environment\./,
    );
  });

  it("treats the scripted provider switch as optional, off unless set", () => {
    expect(resolveAiConfig(complete).stub).toBe(false);
    expect(resolveAiConfig({ ...complete, AI_STUB: "" }).stub).toBe(false);
    expect(resolveAiConfig({ ...complete, AI_STUB: "1" }).stub).toBe(true);
    expect(resolveAiConfig({ ...complete, AI_STUB: "0" }).stub).toBe(false);

    expect(() => resolveAiConfig({ ...complete, AI_STUB: "yes" })).toThrow(
      /AI_STUB must be "0" or "1" when set/,
    );
  });

  it("validates the step and retry limits", () => {
    expect(() => resolveAiConfig({ ...complete, AI_MAX_STEPS: "0" })).toThrow(
      /AI_MAX_STEPS must be a whole number greater than or equal to 1/,
    );
    expect(() => resolveAiConfig({ ...complete, AI_MAX_STEPS: "2.5" })).toThrow(
      /AI_MAX_STEPS must be a whole number/,
    );
    expect(() => resolveAiConfig({ ...complete, AI_MAX_RETRIES: "-1" })).toThrow(
      /AI_MAX_RETRIES must be a whole number greater than or equal to 0/,
    );
  });

  it("rejects a base URL that is only slashes", () => {
    expect(() => resolveAiConfig({ ...complete, AI_BASE_URL: "//" })).toThrow(
      /AI_BASE_URL must be a URL/,
    );
  });

  it("keeps the approval secret optional but refuses a guessable one", () => {
    expect(resolveAiConfig(complete).toolApprovalSecret).toBeUndefined();
    expect(
      resolveAiConfig({ ...complete, AI_TOOL_APPROVAL_SECRET: "x".repeat(32) }).toolApprovalSecret,
    ).toBe("x".repeat(32));
    expect(() => resolveAiConfig({ ...complete, AI_TOOL_APPROVAL_SECRET: "short" })).toThrow(
      /at least 32 characters/,
    );
  });

  it("does not read a provider name at all", () => {
    // The old AI_PROVIDER vocabulary is gone: any extra variable is ignored and
    // the connection is whatever the URL says.
    expect(resolveAiConfig({ ...complete, AI_PROVIDER: "anthropic" }).baseURL).toBe(
      "https://endpoint.test/openai/v1",
    );
  });
});

describe("resolveTitleAiConfig", () => {
  it("reads its own endpoint, with no fallback to the agent's", () => {
    expect(resolveTitleAiConfig(completeTitle)).toEqual({
      baseURL: "https://names.test/openai/v1",
      apiKey: "title-key",
      model: "qwen/qwen3.8-27b",
      stub: false,
    });
  });

  it("requires its own variables even when the agent's are complete", () => {
    expect(() => resolveTitleAiConfig(complete)).toThrow(
      /AI is not configured: set AI_TITLE_BASE_URL, AI_TITLE_API_KEY, AI_TITLE_MODEL/,
    );
  });

  it("shares the optional scripted-provider switch with the agent", () => {
    expect(resolveTitleAiConfig(completeTitle).stub).toBe(false);
    expect(resolveTitleAiConfig({ ...completeTitle, AI_STUB: "1" }).stub).toBe(true);
    expect(() => resolveTitleAiConfig({ ...completeTitle, AI_STUB: "yes" })).toThrow(/AI_STUB/);
  });
});

describe("modelSource", () => {
  it("records the host a prompt ran against, not a provider name", () => {
    expect(modelSource("https://api.groq.com/openai/v1")).toBe("api.groq.com");
    expect(modelSource("http://127.0.0.1:1234/v1")).toBe("127.0.0.1:1234");
  });
});

describe("isAiConfigured", () => {
  it("is false without an environment and true with a complete one", () => {
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_STUB", "");
    vi.stubEnv("AI_MAX_STEPS", "");
    vi.stubEnv("AI_MAX_RETRIES", "");
    expect(isAiConfigured()).toBe(false);

    for (const [name, value] of Object.entries(complete)) vi.stubEnv(name, value);
    expect(isAiConfigured()).toBe(true);
  });
});
