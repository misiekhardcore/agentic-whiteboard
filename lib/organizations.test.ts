import { describe, expect, it } from "vitest";

import {
  canManageTeam,
  resolveActiveTeam,
  TEAM_ADMIN_ROLES,
  type TeamOption,
} from "./organizations";

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

describe("active account", () => {
  const teams: TeamOption[] = [
    {
      id: "org_1",
      name: "Orbit",
      slug: "orbit",
      logo: null,
      role: "owner",
      memberCount: 2,
    },
    {
      id: "org_2",
      name: "Polar",
      slug: "polar",
      logo: null,
      role: "member",
      memberCount: 1,
    },
  ];

  it("selects the organization stored on the session", () => {
    expect(resolveActiveTeam(teams, "org_2")?.name).toBe("Polar");
  });

  it("keeps the personal account when the session has no organization", () => {
    // The old behavior fell back to the first team; these assertions pin the
    // personal choice even when the person belongs to organizations.
    expect(resolveActiveTeam(teams, null)).toBeNull();
    expect(resolveActiveTeam(teams, undefined)).toBeNull();
  });

  it("treats an organization the person left as personal", () => {
    expect(resolveActiveTeam(teams, "org_gone")).toBeNull();
  });
});
