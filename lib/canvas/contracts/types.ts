/**
 * The stored projection of a canvas room: what the engine's document contains,
 * written as plain JSON so the app can persist it and hand it back without
 * understanding every record.
 *
 * It is a snapshot, never the live document. The room is authoritative and the
 * row is the copy a new room starts from.
 */
export type CanvasSnapshot = {
  /** The room's logical clock when the snapshot was taken. */
  clock?: number;
  /** The clock value of the last document change. */
  documentClock?: number;
  /** Every record, with the clock value it last changed at. */
  documents: Array<{
    lastChangedClock: number;
    state: Record<string, unknown>;
  }>;
  /** Deleted record ids and the clock value that deleted them. */
  tombstones?: Record<string, number>;
  /** The clock value older deletions are no longer tracked from. */
  tombstoneHistoryStartsAtClock?: number;
  /** The engine schema the records were written with; needed to migrate them. */
  schema?: Record<string, unknown>;
};

/** What a snapshot write did: the new revision, or the revision that beat it. */
export type CanvasSnapshotWriteResult =
  { ok: true; revision: number } | { ok: false; currentRevision: number | null };
