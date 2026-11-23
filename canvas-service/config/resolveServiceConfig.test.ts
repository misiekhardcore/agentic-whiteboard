import { describe, expect, it } from "vitest";

import { resolveServiceConfig } from "./resolveServiceConfig";
import { ServiceConfigurationError } from "./ServiceConfigurationError";

const unset = {
  CANVAS_SERVICE_PORT: undefined,
  CANVAS_SERVICE_SECRET: undefined,
  CANVAS_APP_INTERNAL_URL: undefined,
};

describe("the canvas service configuration", () => {
  it("resolves the port, the shared secret and the app origin", () => {
    expect(
      resolveServiceConfig({
        CANVAS_SERVICE_PORT: "4200",
        CANVAS_SERVICE_SECRET: "canvas-secret",
        CANVAS_APP_INTERNAL_URL: "http://localhost:3100/",
      }),
    ).toEqual({ port: 4200, serviceSecret: "canvas-secret", appUrl: "http://localhost:3100" });
  });

  it("defaults the port and the app origin for local development", () => {
    expect(resolveServiceConfig({ ...unset, CANVAS_SERVICE_SECRET: "canvas-secret" })).toEqual({
      port: 4100,
      serviceSecret: "canvas-secret",
      appUrl: "http://localhost:3000",
    });
  });

  it("refuses to start without a secret", () => {
    expect(() => resolveServiceConfig(unset)).toThrow(ServiceConfigurationError);
  });

  it("refuses a port or an app address that cannot be used", () => {
    expect(() =>
      resolveServiceConfig({ ...unset, CANVAS_SERVICE_SECRET: "s", CANVAS_SERVICE_PORT: "eighty" }),
    ).toThrow(ServiceConfigurationError);
    expect(() =>
      resolveServiceConfig({
        ...unset,
        CANVAS_SERVICE_SECRET: "s",
        CANVAS_APP_INTERNAL_URL: "localhost",
      }),
    ).toThrow(ServiceConfigurationError);
  });
});
