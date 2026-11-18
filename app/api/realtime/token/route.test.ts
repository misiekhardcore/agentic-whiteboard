import { afterEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock("@/lib/identity/account", () => ({
  getSessionAccount: () => Promise.resolve(account.current),
}));

import { GET } from "./route";

const personal = {
  session: { user: { id: "user_1" } },
  activeOrganizationId: null,
};

const inOrganization = {
  session: { user: { id: "user_1" } },
  activeOrganizationId: "org_1",
};

type TokenResponse = { url: string; key: string; token: string; topics: string[] };

function decodePayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}

function configureStack() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:8000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "publishable");
  vi.stubEnv("JWT_SECRET", "stack-jwt-secret");
}

afterEach(() => {
  vi.unstubAllEnvs();
  account.current = null;
});

describe("the realtime token route", () => {
  it("refuses a caller with no session instead of handing out channels", async () => {
    configureStack();

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("answers 204 when the deployment has no Realtime to join", async () => {
    account.current = personal;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("JWT_SECRET", "");

    const response = await GET();

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("hands a personal session its own channel, with a token carrying its user id", async () => {
    configureStack();
    account.current = personal;

    const response = await GET();
    const session = (await response.json()) as TokenResponse;

    expect(session).toMatchObject({
      url: "http://localhost:8000",
      key: "publishable",
      topics: ["app:user:user_1"],
    });
    // The name and role the RLS policy reads: without either, joining the
    // private channel is refused and no change ever reaches the browser.
    expect(decodePayload(session.token)).toMatchObject({
      sub: "user_1",
      role: "authenticated",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("adds the organization's channel for a session acting in one", async () => {
    configureStack();
    account.current = inOrganization;

    const session = (await (await GET()).json()) as TokenResponse;

    expect(session.topics).toEqual(["app:user:user_1", "app:org:org_1"]);
  });
});
