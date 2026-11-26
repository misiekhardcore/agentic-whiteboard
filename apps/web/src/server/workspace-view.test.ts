import type { Actor } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { describe, expect, it } from "vitest";

import { loadWorkspaceView } from "./workspace-view";
import type { AppDependencies } from "./workspace-view";

const actor: Actor = { type: "user", userId: "user-1", accountId: "account-1" };

const dependencies: AppDependencies = {
  workspaces: {
    findById: (id) =>
      Promise.resolve(
        id === "ws-1"
          ? { id: "ws-1", accountId: "account-1", docRoomId: "doc-1", archived: false }
          : null,
      ),
  },
  rooms: createInMemoryRoomOwner({
    rooms: [
      {
        room: { kind: "doc", id: "doc-1", accountId: "account-1" },
        content: { title: "Product brief" },
        revision: "rev-1",
      },
    ],
  }),
};

describe("loadWorkspaceView", () => {
  it("shows the title and revision the room owner reports", async () => {
    const view = await loadWorkspaceView("ws-1", actor, dependencies);

    expect(view).toEqual({ state: "ready", title: "Product brief", revision: "rev-1" });
  });

  it("renders a missing workspace as not found", async () => {
    const view = await loadWorkspaceView("ws-missing", actor, dependencies);

    expect(view).toMatchObject({ state: "refused", code: "not-found" });
  });
});
