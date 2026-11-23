import { describe, expect, it } from "vitest";

import { canvasConnectionUri } from "./canvasConnectionUri";

describe("a canvas connection address", () => {
  it("names the workspace in the path and carries the token in the query", () => {
    expect(
      canvasConnectionUri({
        serviceUrl: "ws://localhost:4100",
        workspaceId: "wsone9k2m4p7q1r3s5t8u0vx",
        token: "signed.token.value",
      }),
    ).toBe("ws://localhost:4100/connect/wsone9k2m4p7q1r3s5t8u0vx?token=signed.token.value");
  });

  it("leaves the session id to the sync client, which reserves that query name", () => {
    const uri = canvasConnectionUri({
      serviceUrl: "ws://localhost:4100",
      workspaceId: "ws_1",
      token: "t",
    });

    expect(new URL(uri).searchParams.has("sessionId")).toBe(false);
  });

  it("ignores a trailing slash on the configured service address", () => {
    expect(
      canvasConnectionUri({
        serviceUrl: "wss://canvas.example.com/",
        workspaceId: "ws_1",
        token: "t",
      }),
    ).toBe("wss://canvas.example.com/connect/ws_1?token=t");
  });
});
