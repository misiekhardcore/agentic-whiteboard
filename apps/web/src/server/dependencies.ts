import { createWorkspaceStore } from "@v2/db";
import type { WorkspaceStore } from "@v2/db";

import { createDocRoomOwner } from "./doc-room-owner";
import { resolveDocService } from "./doc-service";
import type { AppDependencies } from "./workspace-view";

let store: WorkspaceStore | null = null;
let cached: AppDependencies | null = null;

/**
 * The ports a capability context needs. The actor is not here: it comes from
 * the request's session through `requireActor`, so a caller cannot choose the
 * tenant a capability acts in.
 */
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
        name: row.name,
        accountId: row.accountId,
        docRoomId: row.docRoomId,
        archived: row.archivedAt !== null,
      };
    },
  };

  cached = { workspaces, rooms: createDocRoomOwner(resolveDocService()) };
  return cached;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}
