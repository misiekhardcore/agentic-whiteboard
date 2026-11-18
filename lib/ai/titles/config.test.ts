import { afterEach, describe, expect, it, vi } from "vitest";

import { isTitleConfigured, resolveTitleConfig } from "./config";

const complete = {
  TITLE_AI_BASE_URL: "https://titler.example.test/v1",
  TITLE_AI_API_KEY: "secret-key",
  TITLE_AI_MODEL: "some-small-model",
};

describe("resolveTitleConfig", () => {
  it("requires its own endpoint, independent of the agent's", () => {
    expect(resolveTitleConfig(complete)).toEqual({
      baseURL: "https://titler.example.test/v1",
      apiKey: "secret-key",
      model: "some-small-model",
      reasoningEffort: undefined,
    });
  });

  it("names every missing title variable in one error", () => {
    expect(() => resolveTitleConfig({})).toThrow(
      /TITLE_AI_BASE_URL, TITLE_AI_API_KEY, TITLE_AI_MODEL are required/,
    );
  });

  it("sends a reasoning mode only when configured", () => {
    expect(resolveTitleConfig(complete).reasoningEffort).toBeUndefined();
    expect(
      resolveTitleConfig({ ...complete, TITLE_AI_REASONING_EFFORT: "none" }).reasoningEffort,
    ).toBe("none");
  });

  it("refuses a reasoning mode the endpoint would reject", () => {
    expect(() => resolveTitleConfig({ ...complete, TITLE_AI_REASONING_EFFORT: "maximum" })).toThrow(
      /TITLE_AI_REASONING_EFFORT must be one of/,
    );
  });

  it("reports an unconfigured deployment without throwing", () => {
    expect(isTitleConfigured()).toBe(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});
