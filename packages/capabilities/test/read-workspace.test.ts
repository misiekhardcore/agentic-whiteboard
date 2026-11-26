import type { Actor, RoomOwnerPort } from "@v2/contracts";
import { RoomOwnerError } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { invoke, readWorkspace } from "../src";
import type { CapabilityContext, WorkspaceRecord } from "../src";

const person: Actor = { type: "user", userId: "user-1", accountId: "account-1" };
const outsider: Actor = { type: "user", userId: "user-2", accountId: "account-2" };

const workspace: WorkspaceRecord = {
  id: "ws-1",
  name: "Product brief",
  accountId: "account-1",
  docRoomId: "doc-1",
  archived: false,
};

const context = (actor: Actor, rooms?: RoomOwnerPort): CapabilityContext => ({
  actor,
  workspaces: {
    findById: (id) => Promise.resolve(id === workspace.id ? workspace : null),
  },
  rooms:
    rooms ??
    createInMemoryRoomOwner({
      rooms: [
        {
          room: { kind: "doc", id: workspace.docRoomId, accountId: workspace.accountId },
          content: {},
          revision: "rev-1",
        },
      ],
    }),
});

describe("workspace.read", () => {
  it("returns the workspace name and the revision the room owner reports", async () => {
    const result = await invoke(readWorkspace, context(person), { workspaceId: "ws-1" });

    expect(result).toEqual({
      ok: true,
      title: "Product brief",
      revision: "rev-1",
      readOnly: false,
    });
  });

  it("lets an agent acting in the account read the same workspace", async () => {
    const agent: Actor = {
      type: "agent",
      runId: "run-1",
      accountId: "account-1",
      requestedByUserId: person.userId,
    };

    const result = await invoke(readWorkspace, context(agent), { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: true, title: "Product brief" });
  });

  it("reports an archived workspace as read-only", async () => {
    const archived: WorkspaceRecord = { ...workspace, archived: true };
    const contextForArchived: CapabilityContext = {
      ...context(person),
      workspaces: { findById: () => Promise.resolve(archived) },
    };

    const result = await invoke(readWorkspace, contextForArchived, { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: true, readOnly: true });
  });

  it("keeps the workspace readable when the room owner is unreachable", async () => {
    const unreachable: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => Promise.reject(new RoomOwnerError("apply-refused", "No room")),
      revoke: () => Promise.resolve(),
    };

    const result = await invoke(readWorkspace, context(person, unreachable), {
      workspaceId: "ws-1",
    });

    expect(result).toEqual({
      ok: true,
      title: "Product brief",
      revision: null,
      readOnly: false,
    });
  });

  it("reports a workspace in another account as not found", async () => {
    const result = await invoke(readWorkspace, context(outsider), { workspaceId: "ws-1" });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });

  it("reports a missing workspace as not found", async () => {
    const result = await invoke(readWorkspace, context(person), { workspaceId: "missing" });

    expect(result).toMatchObject({ ok: false, code: "not-found" });
  });
});
