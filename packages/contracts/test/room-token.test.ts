import { describe, expect, it } from "vitest";

import { mintRoomToken, ROOM_TOKEN_TTL_SECONDS, verifyRoomToken } from "../src";

const secret = "test-secret";
const mintedAt = Date.UTC(2026, 10, 26, 12, 0, 0);

function token(overrides: Partial<Parameters<typeof mintRoomToken>[0]> = {}): string {
  return mintRoomToken({
    audience: "doc",
    userId: "user-1",
    roomId: "doc-1",
    accountId: "account-1",
    permission: "write",
    readOnly: false,
    secret,
    now: mintedAt,
    ...overrides,
  });
}

describe("room tokens", () => {
  it("round-trips the claims a room needs", () => {
    expect(verifyRoomToken({ token: token(), audience: "doc", secret, now: mintedAt })).toEqual({
      userId: "user-1",
      roomId: "doc-1",
      accountId: "account-1",
      permission: "write",
      readOnly: false,
      expiresAt: Math.floor(mintedAt / 1000) + ROOM_TOKEN_TTL_SECONDS,
    });
  });

  it("keeps the room the token was minted for", () => {
    const claims = verifyRoomToken({
      token: token({ roomId: "doc-2" }),
      audience: "doc",
      secret,
      now: mintedAt,
    });

    expect(claims?.roomId).toBe("doc-2");
  });

  it("carries read-only for a workspace that can no longer be written", () => {
    const claims = verifyRoomToken({
      token: token({ permission: "read", readOnly: true }),
      audience: "doc",
      secret,
      now: mintedAt,
    });

    expect(claims).toMatchObject({ permission: "read", readOnly: true });
  });

  it("refuses a token for another audience", () => {
    expect(
      verifyRoomToken({
        token: token({ audience: "canvas" }),
        audience: "doc",
        secret,
        now: mintedAt,
      }),
    ).toBeNull();
  });

  it("refuses an expired token", () => {
    const expiredAt = mintedAt + (ROOM_TOKEN_TTL_SECONDS + 1) * 1000;

    expect(verifyRoomToken({ token: token(), audience: "doc", secret, now: expiredAt })).toBeNull();
  });

  it("refuses a token signed with another secret", () => {
    expect(
      verifyRoomToken({
        token: token({ secret: "another-secret" }),
        audience: "doc",
        secret,
        now: mintedAt,
      }),
    ).toBeNull();
  });

  it("refuses a tampered payload", () => {
    const [header, , signature] = token().split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        aud: "doc",
        sub: "user-2",
        roomId: "doc-1",
        accountId: "account-1",
        permission: "write",
        readOnly: false,
        iat: Math.floor(mintedAt / 1000),
        exp: Math.floor(mintedAt / 1000) + ROOM_TOKEN_TTL_SECONDS,
      }),
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(
      verifyRoomToken({
        token: `${header}.${forgedBody}.${signature}`,
        audience: "doc",
        secret,
        now: mintedAt,
      }),
    ).toBeNull();
  });

  it("refuses a value that is not shaped like a token", () => {
    expect(verifyRoomToken({ token: "not-a-token", audience: "doc", secret })).toBeNull();
  });
});
