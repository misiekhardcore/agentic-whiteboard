import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("./auth", () => ({
  appOrigin: () => "http://localhost:3000",
  auth: { api: calls },
}));

import { requestPasswordReset, resetPassword, signIn, signUp } from "./authentication";

function headers(ip: string): Headers {
  return new Headers({ "x-forwarded-for": ip });
}

function uniqueEmail(): string {
  return `rate-${randomUUID()}@example.com`;
}

function uniqueIp(): string {
  return `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
}

beforeEach(() => {
  calls.signInEmail.mockRejectedValue(new Error("invalid"));
  calls.signUpEmail.mockRejectedValue(new Error("invalid"));
  calls.requestPasswordReset.mockResolvedValue(undefined);
  calls.resetPassword.mockRejectedValue(new Error("invalid"));
  vi.clearAllMocks();
});

describe("signIn", () => {
  it("refuses with a retry window once one address has spent its attempts", async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await signIn({ email, password: "wrong", headers: headers(ip) })).ok).toBe(false);
    }

    const refused = await signIn({ email, password: "wrong", headers: headers(ip) });

    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error).toContain("Too many attempts");
    // The sixth attempt never reached better-auth.
    expect(calls.signInEmail).toHaveBeenCalledTimes(5);
  });

  it("spends one address's budget only", async () => {
    const ip = uniqueIp();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await signIn({ email: uniqueEmail(), password: "wrong", headers: headers(ip) });
    }

    expect(calls.signInEmail).toHaveBeenCalledTimes(6);
  });
});

describe("signUp", () => {
  it("rate-limits one address's attempts", async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signUp({ name: "Ada", email, password: "password123", headers: headers(ip) });
    }

    const refused = await signUp({
      name: "Ada",
      email,
      password: "password123",
      headers: headers(ip),
    });

    expect(!refused.ok && refused.error).toContain("Too many attempts");
    expect(calls.signUpEmail).toHaveBeenCalledTimes(5);
  });
});

describe("requestPasswordReset", () => {
  it("answers the same for an unknown address and refuses only after the budget", async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await requestPasswordReset({ email, headers: headers(ip) })).toEqual({ ok: true });
    }

    const refused = await requestPasswordReset({ email, headers: headers(ip) });

    expect(!refused.ok && refused.error).toContain("Too many attempts");
    expect(calls.requestPasswordReset).toHaveBeenCalledTimes(3);
  });
});

describe("resetPassword", () => {
  it("limits attempts on one token", async () => {
    const token = `token-${randomUUID()}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await resetPassword({ token, password: "password123" });
    }

    const refused = await resetPassword({ token, password: "password123" });

    expect(!refused.ok && refused.error).toContain("Too many attempts");
    expect(calls.resetPassword).toHaveBeenCalledTimes(3);
  });
});
