import { describe, expect, it } from "vitest";

import { endpointHost } from "./endpointHost";

describe("endpointHost", () => {
  it("records the endpoint that ran the turn, with its port", () => {
    expect(endpointHost("https://api.example.test:8443/openai/v1")).toBe("api.example.test:8443");
    expect(endpointHost("http://127.0.0.1:1234/v1")).toBe("127.0.0.1:1234");
  });

  it("keeps an unparseable value visible instead of inventing one", () => {
    expect(endpointHost("not a url")).toBe("not a url");
  });
});
