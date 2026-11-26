import { describe, expect, it } from "vitest";

import { readAgentHealth } from "./agent-health";

const respondingFetch = (status: number, body: unknown) => () => {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
};

describe("readAgentHealth", () => {
  it("reports the agent as up when its health endpoint answers", async () => {
    const health = await readAgentHealth({
      url: "http://agent.test",
      fetchImpl: respondingFetch(200, { status: "ok", service: "agent" }),
    });

    expect(health).toEqual({ status: "up", service: "agent" });
  });

  it("reports the agent as down when the endpoint fails", async () => {
    const health = await readAgentHealth({
      url: "http://agent.test",
      fetchImpl: respondingFetch(503, { status: "unavailable" }),
    });

    expect(health.status).toBe("down");
  });

  it("reports the agent as down when it cannot be reached", async () => {
    const health = await readAgentHealth({
      url: "http://agent.test",
      fetchImpl: () => Promise.reject(new Error("connection refused")),
    });

    expect(health).toEqual({ status: "down", detail: "unreachable" });
  });
});
