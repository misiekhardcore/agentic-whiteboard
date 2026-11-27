import { join } from "node:path";

/** The database and the sidecars SQLite may keep beside it, the database first. */
export function canvasRoomFiles({
  directory,
  workspaceId,
}: {
  directory: string;
  workspaceId: string;
}): readonly [string, ...string[]] {
  const database = join(directory, `${workspaceId}.db`);

  return [database, `${database}-wal`, `${database}-shm`];
}
