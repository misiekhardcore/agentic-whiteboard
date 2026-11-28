import { describe, expect, it } from "vitest";

import { invitationRefusal } from "./invitationRefusal";
import type { InvitationForDecision } from "./types";

const invitation: InvitationForDecision = {
  id: "inv-1",
  email: "invited@example.com",
  role: "admin",
  status: "pending",
  expiresAt: new Date("2026-12-01T00:00:00.000Z"),
  organizationId: "org-1",
};

const now = new Date("2026-11-27T00:00:00.000Z");

describe("invitationRefusal", () => {
  it("accepts the invited address while the invitation is pending", () => {
    expect(invitationRefusal(invitation, { email: "invited@example.com" }, now)).toBeNull();
  });

  it("matches the address case-insensitively", () => {
    expect(invitationRefusal(invitation, { email: "Invited@Example.com" }, now)).toBeNull();
  });

  it("refuses a person signed in as another address", () => {
    expect(invitationRefusal(invitation, { email: "someone@example.com" }, now)).toContain(
      "invited@example.com",
    );
  });

  it("refuses an invitation that has already been accepted", () => {
    expect(
      invitationRefusal(
        { ...invitation, status: "accepted" },
        { email: "invited@example.com" },
        now,
      ),
    ).toBe("This invitation is no longer pending.");
  });

  it("refuses an expired invitation before it is ever accepted", () => {
    expect(
      invitationRefusal(
        { ...invitation, expiresAt: new Date("2026-11-26T00:00:00.000Z") },
        { email: "invited@example.com" },
        now,
      ),
    ).toBe("This invitation has expired. Ask a team admin to send a new one.");
  });
});
