import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaConfigurationError } from "./MediaConfigurationError";
import { resolveMediaConfig } from "./resolveMediaConfig";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the media store's configuration", () => {
  it("is absent when the deployment stores no media", () => {
    expect(resolveMediaConfig({})).toBeNull();
  });

  it("is absent when only half of the stack is configured", () => {
    expect(resolveMediaConfig({ SUPABASE_URL: "http://localhost:8000" })).toBeNull();
  });

  it("reads the stack's origin without a trailing slash and defaults the bucket", () => {
    expect(
      resolveMediaConfig({
        SUPABASE_URL: "http://localhost:8000/",
        SUPABASE_SERVICE_ROLE_KEY: " secret ",
      }),
    ).toEqual({
      supabaseUrl: "http://localhost:8000",
      serviceRoleKey: "secret",
      bucket: "media",
    });
  });

  it("uses the bucket the deployment names", () => {
    expect(
      resolveMediaConfig({
        SUPABASE_URL: "http://localhost:8000",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
        MEDIA_BUCKET: "workspace-media",
      })?.bucket,
    ).toBe("workspace-media");
  });

  it("refuses an origin that is not http(s)", () => {
    expect(() =>
      resolveMediaConfig({
        SUPABASE_URL: "ws://localhost:8000",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      }),
    ).toThrow(MediaConfigurationError);
  });
});
