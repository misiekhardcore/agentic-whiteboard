import { describe, expect, it } from "vitest";

import { accountFor } from "./accountFor";

describe("accountFor", () => {
  it("uses the organization the session names when the person is a member", () => {
    expect(
      accountFor({
        userId: "user-1",
        activeOrganizationId: "org-1",
        isMember: true,
      }),
    ).toEqual({ id: "org-1", organizationId: "org-1" });
  });

  it("falls back to the personal account when the session names no organization", () => {
    expect(
      accountFor({
        userId: "user-1",
        activeOrganizationId: null,
        isMember: false,
      }),
    ).toEqual({ id: "user-1", organizationId: null });
  });

  it("falls back to the personal account when the membership is gone", () => {
    // A removed member keeps a cookie naming the organization. The account is
    // the person's own rather than the organization they no longer belong to.
    expect(
      accountFor({
        userId: "user-1",
        activeOrganizationId: "org-1",
        isMember: false,
      }),
    ).toEqual({ id: "user-1", organizationId: null });
  });
});
