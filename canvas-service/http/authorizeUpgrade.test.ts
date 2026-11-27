import { describe, expect, it } from "vitest";

import { mintCanvasToken } from "@/lib/canvas/tokens";

import { authorizeCanvasUpgrade } from "./authorizeUpgrade";

const secret = "canvas-service-secret";
const workspaceId = "wsone9k2m4p7q1r3s5t8u0vx";
const now = new Date("2026-11-23T10:00:00Z").getTime();

function token(overrides: Partial<Parameters<typeof mintCanvasToken>[0]> = {}) {
  return mintCanvasToken({
    userId: "user_1",
    workspaceId,
    permission: "edit",
    readOnly: false,
    secret,
    now,
    ...overrides,
  });
}

function upgradeUrl({
  path = `/connect/${workspaceId}`,
  sessionId = "tab_1",
  value = token(),
}: {
  path?: string;
  sessionId?: string | null;
  value?: string;
} = {}) {
  const params = new URLSearchParams({ token: value });
  if (sessionId) params.set("sessionId", sessionId);

  return `${path}?${params.toString()}`;
}

describe("a canvas socket upgrade", () => {
  it("is accepted with the workspace, session and read-only flag it names", () => {
    expect(authorizeCanvasUpgrade({ requestUrl: upgradeUrl(), secret, now })).toEqual({
      ok: true,
      workspaceId,
      sessionId: "tab_1",
      userId: "user_1",
      readOnly: false,
    });
  });

  it("carries the token's read-only flag into the room", () => {
    const readOnlyToken = token({ readOnly: true });

    expect(
      authorizeCanvasUpgrade({ requestUrl: upgradeUrl({ value: readOnlyToken }), secret, now }),
    ).toMatchObject({ ok: true, readOnly: true });
  });

  it("is refused when the token has expired", () => {
    const later = now + 61_000;

    expect(authorizeCanvasUpgrade({ requestUrl: upgradeUrl(), secret, now: later })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("is refused when the token was minted for another workspace", () => {
    const otherWorkspaceToken = token({ workspaceId: "wsother9k2m4p7q1r3s5" });

    expect(
      authorizeCanvasUpgrade({
        requestUrl: upgradeUrl({ value: otherWorkspaceToken }),
        secret,
        now,
      }),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("is refused without a session id or on an unknown path", () => {
    expect(
      authorizeCanvasUpgrade({ requestUrl: upgradeUrl({ sessionId: null }), secret, now }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      authorizeCanvasUpgrade({ requestUrl: upgradeUrl({ path: "/connect" }), secret, now }),
    ).toMatchObject({ ok: false, status: 404 });
  });
});
