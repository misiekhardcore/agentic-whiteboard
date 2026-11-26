import type { RoomOwnerPort, UserActor } from "@v2/contracts";
import { createInMemoryRoomOwner } from "@v2/contracts/testing";
import { createWorkspaceStore } from "@v2/db";
import type { WorkspaceStore } from "@v2/db";
import { DEMO_WORKSPACE } from "@v2/db/demo";

import type { AppDependencies } from "./workspace-view";

/**
 * Temporary wiring until the accounts slice: the skeleton has no session yet,
 * so it reads the seeded demo workspace in the seeded demo account.
 */
export const demoActor: UserActor = {
  type: "user",
  userId: "user_demo",
  accountId: DEMO_WORKSPACE.accountId,
};

const DEMO_DOCUMENT_TITLE = "Product brief";

/**
 * The in-memory room owner is the reference implementation this slice ships.
 * A later slice replaces it with the document service behind the same port.
 */
export const demoRoomOwner: RoomOwnerPort = createInMemoryRoomOwner({
  rooms: [
    {
      room: { kind: "doc", id: DEMO_WORKSPACE.docRoomId, accountId: DEMO_WORKSPACE.accountId },
      content: { title: DEMO_DOCUMENT_TITLE },
      revision: "rev-1",
    },
  ],
});

let store: WorkspaceStore | null = null;
let cached: AppDependencies | null = null;

export function getDependencies(): AppDependencies {
  if (cached !== null) return cached;

  const workspaceStore = store ?? createWorkspaceStore(databaseUrl());
  store = workspaceStore;

  const workspaces = {
    async findById(id: string) {
      const row = await workspaceStore.findById(id);
      if (row === null) return null;
      return {
        id: row.id,
        accountId: row.accountId,
        docRoomId: row.docRoomId,
        archived: row.archivedAt !== null,
      };
    },
  };

  cached = { workspaces, rooms: demoRoomOwner };
  return cached;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}
