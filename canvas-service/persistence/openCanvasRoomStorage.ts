import { NodeSqliteWrapper, type RoomSnapshot, SQLiteSyncStorage } from "@tldraw/sync-core";
import { createTLSchema, type TLRecord } from "@tldraw/tlschema";
import { mkdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type { CanvasSnapshot } from "@/lib/canvas/contracts";

import { canvasRoomFiles } from "./canvasRoomFiles";
import type { CanvasRoomStorage } from "./types";

/** The clock of a stored projection, on the scale the SQLite file reports. */
function snapshotClock(snapshot: CanvasSnapshot): number {
  return snapshot.documentClock ?? snapshot.clock ?? 0;
}

/**
 * The room's working store. The row seeds it only on first access, so a restart
 * reopens the document without an app round-trip; a projection that moved on
 * while this file was away (a restored volume, a host that never had it) wins
 * instead of being silently ignored. The row stays the durable copy either way,
 * so a lost file costs the edits since the last projection write and nothing
 * more.
 */
export function openCanvasRoomStorage({
  directory,
  workspaceId,
  stored,
}: {
  directory: string;
  workspaceId: string;
  stored: { revision: number; snapshot: CanvasSnapshot | null };
}): CanvasRoomStorage {
  mkdirSync(directory, { recursive: true });

  const [databasePath] = canvasRoomFiles({ directory, workspaceId });
  const rowSnapshot = stored.snapshot ?? null;
  const rowClock = rowSnapshot ? snapshotClock(rowSnapshot) : null;

  let database = new DatabaseSync(databasePath);
  let fileClock = SQLiteSyncStorage.getDocumentClock(new NodeSqliteWrapper(database));

  // A file that exists but never received a record reports no clock; only a
  // readable clock can be compared with the row's.
  const staleFile = rowClock !== null && fileClock !== null && rowClock > fileClock;
  if (staleFile) {
    database.close();
    for (const file of canvasRoomFiles({ directory, workspaceId })) rmSync(file, { force: true });
    database = new DatabaseSync(databasePath);
    fileClock = null;
  }

  // The engine binds the serialised schema when it seeds a file and refuses an
  // undefined binding, while a stored projection may predate the field. The
  // room's own schema is the honest default: those records are read as current,
  // which is what a row without a schema was written by.
  const seed =
    fileClock === null && rowSnapshot
      ? ({
          ...rowSnapshot,
          schema: rowSnapshot.schema ?? createTLSchema().serialize(),
        } as unknown as RoomSnapshot)
      : undefined;

  const storage = new SQLiteSyncStorage<TLRecord>({
    sql: new NodeSqliteWrapper(database),
    snapshot: seed,
  });

  return { storage, close: () => database.close() };
}
