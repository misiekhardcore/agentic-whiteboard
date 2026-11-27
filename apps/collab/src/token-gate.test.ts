import { mintRoomToken, ROOM_TOKEN_TTL_SECONDS } from "@v2/contracts";
import { describe, expect, it } from "vitest";

import { authorizeDocConnection, connectionIsReadOnly } from "./token-gate";

const secret = "doc-secret";
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

describe("the document connection gate", () => {
  it("accepts a token minted for this document", () => {
    const decision = authorizeDocConnection({
      token: token(),
      documentName: "doc-1",
      secret,
      now: mintedAt,
    });

    expect(decision).toMatchObject({ ok: true, claims: { userId: "user-1", roomId: "doc-1" } });
  });

  it("refuses a token minted for another document", () => {
    const decision = authorizeDocConnection({
      token: token({ roomId: "doc-2" }),
      documentName: "doc-1",
      secret,
      now: mintedAt,
    });

    expect(decision).toEqual({
      ok: false,
      reason: "That document token is for another document.",
    });
  });

  it("refuses an expired token", () => {
    const decision = authorizeDocConnection({
      token: token(),
      documentName: "doc-1",
      secret,
      now: mintedAt + (ROOM_TOKEN_TTL_SECONDS + 1) * 1000,
    });

    expect(decision).toMatchObject({ ok: false });
  });

  it("refuses a token signed with another secret", () => {
    const decision = authorizeDocConnection({
      token: token({ secret: "another-secret" }),
      documentName: "doc-1",
      secret,
      now: mintedAt,
    });

    expect(decision).toMatchObject({ ok: false });
  });
});

describe("the read-only decision", () => {
  function claims(overrides: Partial<Parameters<typeof mintRoomToken>[0]>) {
    const decision = authorizeDocConnection({
      token: token(overrides),
      documentName: "doc-1",
      secret,
      now: mintedAt,
    });
    if (!decision.ok) throw new Error("fixture token was refused");

    return decision.claims;
  }

  it("allows a write claim on a live workspace", () => {
    expect(connectionIsReadOnly(claims({}))).toBe(false);
  });

  it("enforces read-only from the claim even with a write permission", () => {
    expect(connectionIsReadOnly(claims({ readOnly: true }))).toBe(true);
  });

  it("treats a read permission as read-only", () => {
    expect(connectionIsReadOnly(claims({ permission: "read", readOnly: true }))).toBe(true);
  });
});
