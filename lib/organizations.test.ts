import { describe, expect, it } from "vitest";

import { canManageTeam, TEAM_ADMIN_ROLES } from "./organizations";

describe("team roles", () => {
  it("lets owners and admins manage billing and members", () => {
    expect(TEAM_ADMIN_ROLES).toEqual(["owner", "admin"]);
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
  });

  it("keeps plain members out of team management", () => {
    expect(canManageTeam("member")).toBe(false);
    expect(canManageTeam("")).toBe(false);
    expect(canManageTeam("OWNER")).toBe(false);
  });
});
