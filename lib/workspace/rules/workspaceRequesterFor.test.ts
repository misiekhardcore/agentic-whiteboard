import { describe, expect, it } from "vitest";

import { workspaceRequesterFor } from "./workspaceRequesterFor";

const actor = { userId: "user_1", organizationId: null, accountName: "Personal account" };

describe("the requester a capability's change is recorded against", () => {
  it("records the person who made a human call", () => {
    expect(workspaceRequesterFor({ actorType: "human", actor })).toEqual({
      ...actor,
      actorType: "PERSON",
    });
  });

  it("records the agent, keeping the person it acted for", () => {
    expect(workspaceRequesterFor({ actorType: "agent", actor })).toEqual({
      ...actor,
      actorType: "AGENT",
    });
  });
});
