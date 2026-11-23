import { describe, expect, it } from "vitest";

import { CanvasConfigurationError } from "./CanvasConfigurationError";
import { resolveCanvasConfig } from "./resolveCanvasConfig";

describe("the canvas configuration", () => {
  it("resolves the service address and the shared secret, trimmed", () => {
    expect(
      resolveCanvasConfig({
        NEXT_PUBLIC_CANVAS_SERVICE_URL: " ws://localhost:4100 ",
        CANVAS_SERVICE_SECRET: "canvas-secret",
      }),
    ).toEqual({
      serviceUrl: "ws://localhost:4100",
      httpOrigin: "http://localhost:4100",
      serviceSecret: "canvas-secret",
    });
  });

  it("maps a secure socket to the secure HTTP origin", () => {
    expect(
      resolveCanvasConfig({
        NEXT_PUBLIC_CANVAS_SERVICE_URL: "wss://canvas.example.com/",
        CANVAS_SERVICE_SECRET: "canvas-secret",
      })?.httpOrigin,
    ).toBe("https://canvas.example.com");
  });

  it("is absent when the deployment does not run the canvas service", () => {
    const unset = { NEXT_PUBLIC_CANVAS_SERVICE_URL: undefined, CANVAS_SERVICE_SECRET: undefined };

    expect(resolveCanvasConfig(unset)).toBeNull();
    expect(
      resolveCanvasConfig({ NEXT_PUBLIC_CANVAS_SERVICE_URL: "", CANVAS_SERVICE_SECRET: "" }),
    ).toBeNull();
    expect(
      resolveCanvasConfig({ ...unset, NEXT_PUBLIC_CANVAS_SERVICE_URL: "ws://localhost:4100" }),
    ).toBeNull();
  });

  it("refuses an address a browser cannot open a socket to", () => {
    expect(() =>
      resolveCanvasConfig({
        NEXT_PUBLIC_CANVAS_SERVICE_URL: "http://localhost:4100",
        CANVAS_SERVICE_SECRET: "canvas-secret",
      }),
    ).toThrow(CanvasConfigurationError);
  });
});
