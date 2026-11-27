import { describe, expect, it, vi } from "vitest";

import { resolveSessionActor } from "./resolveSessionActor";
import type { IdentityDeps, IdentitySession } from "./types";

const session: IdentitySession = {
  user: { id: "user-1", name: "Ada", email: "ada@example.com" },
  session: { activeOrganizationId: "org-1" },
};

function deps(overrides: Partial<IdentityDeps> = {}): IdentityDeps {
  return {
    getSession: () => Promise.resolve(session),
    isMember: () => Promise.resolve(true),
    ...overrides,
  };
}

describe("resolveSessionActor", () => {
  it("builds the actor from the session and the membership it names", async () => {
    const isMember = vi.fn(() => Promise.resolve(true));

    const resolved = await resolveSessionActor(new Headers(), deps({ isMember }));

    expect(resolved).toEqual({
      actor: { type: "user", userId: "user-1", accountId: "org-1" },
      person: { name: "Ada", email: "ada@example.com" },
      account: { id: "org-1", organizationId: "org-1" },
    });
    expect(isMember).toHaveBeenCalledWith("org-1", "user-1");
  });

  it("answers null without a session", async () => {
    const resolved = await resolveSessionActor(
      new Headers(),
      deps({ getSession: () => Promise.resolve(null) }),
    );

    expect(resolved).toBeNull();
  });

  it("never reads an account from a request header", async () => {
    // Only the session names the account. A header that a proxy or a test
    // sends must change nothing.
    const headers = new Headers({
      "x-account-id": "org-somebody-else",
      "x-organization-id": "org-somebody-else",
      "x-user-id": "user-somebody-else",
    });

    const resolved = await resolveSessionActor(headers, deps());

    expect(resolved?.actor).toEqual({ type: "user", userId: "user-1", accountId: "org-1" });
  });

  it("treats a session naming a lost membership as the personal account", async () => {
    const resolved = await resolveSessionActor(
      new Headers(),
      deps({ isMember: () => Promise.resolve(false) }),
    );

    expect(resolved?.actor).toEqual({ type: "user", userId: "user-1", accountId: "user-1" });
    expect(resolved?.account).toEqual({ id: "user-1", organizationId: null });
  });

  it("asks the session for the same headers it was given", async () => {
    const headers = new Headers({ cookie: "better-auth.session_token=abc" });
    const getSession = vi.fn(() => Promise.resolve(session));

    await resolveSessionActor(headers, deps({ getSession }));

    expect(getSession).toHaveBeenCalledWith(headers);
  });
});
