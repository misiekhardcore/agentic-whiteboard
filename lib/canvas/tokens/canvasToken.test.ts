import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { CANVAS_TOKEN_AUDIENCE, CANVAS_TOKEN_TTL_SECONDS } from "./constants";
import { mintCanvasToken } from "./mintCanvasToken";
import { verifyCanvasToken } from "./verifyCanvasToken";

const secret = "canvas-service-secret-for-the-test";
const at = new Date("2026-11-23T10:00:00Z").getTime();
const issuedAt = Math.floor(at / 1000);

const claims = {
  userId: "user_1",
  workspaceId: "wsone9k2m4p7q1r3s5t8u0vx",
  permission: "edit" as const,
  readOnly: false,
};

function mint(overrides: Partial<Parameters<typeof mintCanvasToken>[0]> = {}) {
  return mintCanvasToken({ ...claims, secret, now: at, ...overrides });
}

/** Signs an arbitrary payload the way the wire format does, for forgery cases. */
function sign(payload: Record<string, unknown>, signingSecret = secret): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = createHmac("sha256", signingSecret).update(`${header}.${body}`).digest();

  return `${header}.${body}.${encode(signature)}`;
}

describe("a canvas connection token", () => {
  it("verifies to the claims it was minted with", () => {
    expect(verifyCanvasToken({ token: mint(), secret, now: at })).toEqual({
      ...claims,
      expiresAt: issuedAt + CANVAS_TOKEN_TTL_SECONDS,
    });
  });

  it("carries the read-only flag for an archived workspace", () => {
    const token = mint({ readOnly: true, permission: "view" });

    expect(verifyCanvasToken({ token, secret, now: at })).toMatchObject({
      permission: "view",
      readOnly: true,
    });
  });

  it("is refused once it expires", () => {
    const token = mint();
    const expiredAt = at + (CANVAS_TOKEN_TTL_SECONDS + 1) * 1000;

    expect(verifyCanvasToken({ token, secret, now: expiredAt })).toBeNull();
  });

  it("is refused when it was signed with another secret", () => {
    expect(verifyCanvasToken({ token: mint(), secret: "another-secret", now: at })).toBeNull();
  });

  it("is refused when its claims were edited", () => {
    const [header, , signature] = mint().split(".");
    const forged = Buffer.from(
      JSON.stringify({
        aud: CANVAS_TOKEN_AUDIENCE,
        sub: "user_2",
        workspaceId: claims.workspaceId,
        permission: "edit",
        readOnly: false,
        iat: issuedAt,
        exp: issuedAt + 60,
      }),
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(
      verifyCanvasToken({ token: `${header}.${forged}.${signature}`, secret, now: at }),
    ).toBeNull();
  });

  it("is refused when it was issued for another audience", () => {
    const token = sign({
      aud: "realtime",
      sub: claims.userId,
      workspaceId: claims.workspaceId,
      permission: "edit",
      readOnly: false,
      iat: issuedAt,
      exp: issuedAt + 60,
    });

    expect(verifyCanvasToken({ token, secret, now: at })).toBeNull();
  });

  it("is refused when its claims do not describe a connection", () => {
    const missing = sign({
      aud: CANVAS_TOKEN_AUDIENCE,
      sub: claims.userId,
      iat: issuedAt,
      exp: issuedAt + 60,
    });

    expect(verifyCanvasToken({ token: missing, secret, now: at })).toBeNull();
  });

  it("refuses a value that is not a token at all", () => {
    expect(verifyCanvasToken({ token: "", secret, now: at })).toBeNull();
    expect(verifyCanvasToken({ token: "not.a.token", secret, now: at })).toBeNull();
  });
});
