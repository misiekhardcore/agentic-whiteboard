import { eq } from "drizzle-orm";

import { createDatabase } from "./database";
import { workspace } from "./schema";
import type { WorkspaceRow } from "./schema";

export type WorkspaceStore = {
  findById(id: string): Promise<WorkspaceRow | null>;
  close(): Promise<void>;
};

/**
 * A thin row accessor. The app maps the row onto the capability's port; it does
 * not import a driver, write SQL or open its own connection.
 */
export function createWorkspaceStore(url: string): WorkspaceStore {
  const { database, pool } = createDatabase(url);

  return {
    async findById(id) {
      const rows = await database.select().from(workspace).where(eq(workspace.id, id)).limit(1);
      return rows.at(0) ?? null;
    },
    close: () => pool.end(),
  };
}
