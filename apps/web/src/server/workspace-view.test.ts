import type { Actor, RoomOwnerPort } from "@v2/contracts";
import { RoomOwnerError } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { loadWorkspaceView } from "./workspace-view";
import type { AppDependencies } from "./workspace-view";

const actor: Actor = { type: "user", userId: "user-1", accountId: "account-1" };

const dependencies = (rooms?: RoomOwnerPort): AppDependencies => ({
  workspaces: {
    findById: (id) =>
      Promise.resolve(
        id === "ws-1"
          ? {
              id: "ws-1",
              name: "Product brief",
              accountId: "account-1",
              docRoomId: "doc-1",
              archived: false,
            }
          : null,
      ),
  },
  rooms:
    rooms ??
    createInMemoryRoomOwner({
      rooms: [
        {
          room: { kind: "doc", id: "doc-1", accountId: "account-1" },
          content: {},
          revision: "rev-1",
        },
      ],
    }),
});

describe("loadWorkspaceView", () => {
  it("shows the workspace name and the revision the room owner reports", async () => {
    const view = await loadWorkspaceView("ws-1", actor, dependencies());

    expect(view).toEqual({
      state: "ready",
      title: "Product brief",
      revision: "rev-1",
      readOnly: false,
    });
  });

  it("keeps the workspace readable when the room owner is down", async () => {
    const unreachable: RoomOwnerPort = {
      snapshot: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      apply: () => Promise.reject(new RoomOwnerError("apply-refused", "No room")),
      save: () => Promise.reject(new RoomOwnerError("room-not-found", "No room")),
      revoke: () => Promise.resolve(),
    };

    const view = await loadWorkspaceView("ws-1", actor, dependencies(unreachable));

    expect(view).toEqual({
      state: "ready",
      title: "Product brief",
      revision: null,
      readOnly: false,
    });
  });

  it("renders a missing workspace as not found", async () => {
    const view = await loadWorkspaceView("ws-missing", actor, dependencies());

    expect(view).toMatchObject({ state: "refused", code: "not-found" });
  });
});
