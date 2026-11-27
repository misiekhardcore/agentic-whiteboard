import { describe, expect, it } from "vitest";

import { clientIp } from "./clientIp";

describe("clientIp", () => {
  it("uses the first address a proxy adds", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" });

    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to the direct address header", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("names an unknown caller once, so attempts still share a budget", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
