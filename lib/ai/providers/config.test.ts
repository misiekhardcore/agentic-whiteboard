import { describe, expect, it } from "vitest";

import { AiConfigurationError, resolveAiConfig } from "./index";

const complete = {
  AI_BASE_URL: "https://ai.example.test/openai/v1",
  AI_API_KEY: "secret-key",
  AI_MODEL: "some-model",
};

describe("resolveAiConfig", () => {
  it("requires the endpoint, key and model with no provider default", () => {
    expect(resolveAiConfig(complete)).toEqual({
      baseURL: "https://ai.example.test/openai/v1",
      apiKey: "secret-key",
      model: "some-model",
      toolApprovalSecret: undefined,
      maxSteps: 20,
      maxRetries: 2,
    });
  });

  it("names every missing variable in one error", () => {
    expect(() => resolveAiConfig({})).toThrow(AiConfigurationError);
    expect(() => resolveAiConfig({})).toThrow(
      /AI_BASE_URL, AI_API_KEY, AI_MODEL.*assumes no provider/,
    );
  });

  it("rejects a base URL that is not an absolute http(s) endpoint", () => {
    expect(() => resolveAiConfig({ ...complete, AI_BASE_URL: "ai.example.test/v1" })).toThrow(
      /absolute http\(s\) URL/,
    );
    expect(() => resolveAiConfig({ ...complete, AI_BASE_URL: "file:///tmp/v1" })).toThrow(
      /http or https/,
    );
  });

  it("trims a trailing slash so request paths stay single-slash", () => {
    expect(
      resolveAiConfig({ ...complete, AI_BASE_URL: "https://ai.example.test/v1//" }).baseURL,
    ).toBe("https://ai.example.test/v1");
  });

  it("keeps the numeric knobs optional and validated", () => {
    expect(resolveAiConfig({ ...complete, AI_MAX_STEPS: "3", AI_MAX_RETRIES: "0" })).toMatchObject({
      maxSteps: 3,
      maxRetries: 0,
    });

    expect(() => resolveAiConfig({ ...complete, AI_MAX_STEPS: "many" })).toThrow(/AI_MAX_STEPS/);
    expect(() => resolveAiConfig({ ...complete, AI_MAX_RETRIES: "-1" })).toThrow(/AI_MAX_RETRIES/);
  });

  it("refuses a short approval secret", () => {
    expect(() => resolveAiConfig({ ...complete, AI_TOOL_APPROVAL_SECRET: "too-short" })).toThrow(
      /at least 32 characters/,
    );
  });
});
