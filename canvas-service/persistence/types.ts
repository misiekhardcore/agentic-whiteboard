import type { TLSyncStorage } from "@tldraw/sync-core";
import type { TLRecord } from "@tldraw/tlschema";

/** One canvas's working store: the SQLite file its room lives in while it is open. */
export type CanvasRoomStorage = {
  storage: TLSyncStorage<TLRecord>;
  /** Closes the database; the file stays, for the room that reopens it. */
  close(): void;
};
