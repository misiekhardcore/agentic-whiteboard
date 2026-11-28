import { afterEach, describe, expect, it, vi } from "vitest";

import { enabledProviders, isOAuthProvider } from "./providerSignIn";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enabledProviders", () => {
  it("offers a provider only when both of its credentials are set", () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");

    expect(enabledProviders()).toEqual(["google"]);
  });

  it("offers nothing on a deployment with no provider", () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    expect(enabledProviders()).toEqual([]);
  });

  it("refuses a provider name it does not know", () => {
    expect(isOAuthProvider("github")).toBe(true);
    expect(isOAuthProvider("gitlab")).toBe(false);
  });
});
