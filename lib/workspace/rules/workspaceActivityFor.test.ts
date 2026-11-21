import { describe, expect, it } from "vitest";

import type { WorkspaceActivityChange, WorkspaceRequester } from "../activity";

import { workspaceActivityFor } from "./workspaceActivityFor";

const person: WorkspaceRequester = {
  userId: "user_1",
  organizationId: null,
  accountName: "Personal account",
  actorType: "PERSON",
};

const rename: WorkspaceActivityChange = {
  surface: "WORKSPACE",
  kind: "RENAMED",
  details: { from: "Roadmap", to: "Launch" },
};

const stageMove: WorkspaceActivityChange = {
  surface: "WORKSPACE",
  kind: "STAGE_MOVED",
  details: { from: "PLANNING", to: "IN_PROGRESS" },
};

describe("the activity rows a change writes", () => {
  it("stamps every change with its workspace and the requester", () => {
    expect(workspaceActivityFor("ws_1", [rename, stageMove], person)).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "RENAMED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: { from: "Roadmap", to: "Launch" },
      },
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "STAGE_MOVED",
        actorType: "PERSON",
        actorUserId: "user_1",
        details: { from: "PLANNING", to: "IN_PROGRESS" },
      },
    ]);
  });

  it("records the agent as the actor and still names the person it acted for", () => {
    expect(workspaceActivityFor("ws_1", [rename], { ...person, actorType: "AGENT" })).toEqual([
      {
        workspaceId: "ws_1",
        surface: "WORKSPACE",
        kind: "RENAMED",
        actorType: "AGENT",
        actorUserId: "user_1",
        details: { from: "Roadmap", to: "Launch" },
      },
    ]);
  });

  it("writes no rows when the change list is empty", () => {
    expect(workspaceActivityFor("ws_1", [], person)).toEqual([]);
  });
});
