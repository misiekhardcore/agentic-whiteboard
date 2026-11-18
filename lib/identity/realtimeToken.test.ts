import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { mintRealtimeToken } from "./realtimeToken";

const secret = "stack-jwt-secret";
const now = Date.UTC(2026, 10, 18, 12, 0, 0);

function parts(token: string) {
  const [header, payload, signature] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >,
    payload: JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >,
    signature,
  };
}

function expectedSignature(token: string): string {
  const [header, payload] = token.split(".");
  return createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url")
    .replace(/=+$/, "");
}

describe("mintRealtimeToken", () => {
  it("carries the person as sub, with the role RLS checks", () => {
    const token = mintRealtimeToken({ userId: "user_1", secret, now });
    const { header, payload } = parts(token);

    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload).toMatchObject({
      sub: "user_1",
      role: "authenticated",
      aud: "authenticated",
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    });
  });

  it("is signed with the stack's secret, so Realtime can verify it", () => {
    const token = mintRealtimeToken({ userId: "user_1", secret, now });

    expect(parts(token).signature).toBe(expectedSignature(token));
  });

  it("expires, instead of outliving the session it was minted for", () => {
    const token = mintRealtimeToken({ userId: "user_1", secret, now, ttlSeconds: 60 });
    const { payload } = parts(token);

    expect(Number(payload.exp) - Number(payload.iat)).toBe(60);
  });
});
