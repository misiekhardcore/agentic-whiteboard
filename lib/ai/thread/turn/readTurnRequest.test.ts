import { describe, expect, it } from "vitest";

import { userMessage } from "../rules/fixtures.test-helpers";

import { readTurnRequest } from "./readTurnRequest";

const conversationId = "conversation_1";

const payload = (extra: Record<string, unknown> = {}) => ({
  conversationId,
  messages: [userMessage("user_1", "Plan the schema")],
  ...extra,
});

describe("readTurnRequest", () => {
  it("reads the send, its conversation and the view it came from", () => {
    const request = readTurnRequest(
      payload({ uiContext: { pathname: "/dashboard", workspaceId: "ws_1" } }),
    );

    expect("error" in request).toBe(false);
    expect(request).toMatchObject({
      conversationId,
      kind: "new",
      uiContext: { pathname: "/dashboard", workspaceId: "ws_1" },
    });
    if ("error" in request) throw new Error("expected a request");
    expect(request.newest.id).toBe("user_1");
  });

  it("ignores a view that is not an in-app path", () => {
    const request = readTurnRequest(payload({ uiContext: { pathname: "https://elsewhere.test" } }));

    if ("error" in request) throw new Error("expected a request");
    expect(request.uiContext).toBeNull();
  });

  it("refuses a body with no messages", async () => {
    const request = readTurnRequest({ conversationId, messages: [] });

    if (!("error" in request)) throw new Error("expected a refusal");
    expect(request.error.status).toBe(400);
    await expect(request.error.json()).resolves.toMatchObject({
      error: "Send at least one prompt to the agent.",
    });
  });

  it("refuses a body without a usable conversation id", () => {
    const request = readTurnRequest({ messages: [userMessage("user_1", "Plan the schema")] });

    if (!("error" in request)) throw new Error("expected a refusal");
    expect(request.error.status).toBe(400);
  });

  it("refuses a prompt with no words", () => {
    const request = readTurnRequest(payload({ messages: [userMessage("user_1", "")] }));

    if (!("error" in request)) throw new Error("expected a refusal");
    expect(request.error.status).toBe(400);
  });
});
