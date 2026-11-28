import { describe, expect, it } from "vitest";

import { createSlidingWindowLimiter } from "./rateLimit";

describe("createSlidingWindowLimiter", () => {
  it("allows attempts up to the limit and refuses the next one", () => {
    const limiter = createSlidingWindowLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.check("ip:1.2.3.4", 0).allowed).toBe(true);
    expect(limiter.check("ip:1.2.3.4", 1_000).allowed).toBe(true);
    expect(limiter.check("ip:1.2.3.4", 2_000).allowed).toBe(true);
    expect(limiter.check("ip:1.2.3.4", 3_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 57,
    });
  });

  it("keeps one key's attempts from spending another key's budget", () => {
    const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("email:a@example.com", 0).allowed).toBe(true);
    expect(limiter.check("email:b@example.com", 0).allowed).toBe(true);
    expect(limiter.check("email:a@example.com", 0).allowed).toBe(false);
  });

  it("allows again once the window has passed", () => {
    const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("email:a@example.com", 0).allowed).toBe(true);
    expect(limiter.check("email:a@example.com", 30_000).allowed).toBe(false);
    expect(limiter.check("email:a@example.com", 60_001).allowed).toBe(true);
  });

  it("never reports a retry window shorter than a second", () => {
    const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: 60_000 });

    limiter.check("ip:1.2.3.4", 0);

    expect(limiter.check("ip:1.2.3.4", 59_900)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it("forgets a key entirely so a long-idle address starts clean", () => {
    const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: 1_000 });

    limiter.check("ip:1.2.3.4", 0);
    limiter.check("ip:1.2.3.4", 0);
    expect(limiter.check("ip:1.2.3.4", 5_000).allowed).toBe(true);
    expect(limiter.check("ip:1.2.3.4", 5_000).allowed).toBe(true);
    expect(limiter.check("ip:1.2.3.4", 5_000).allowed).toBe(false);
  });
});
