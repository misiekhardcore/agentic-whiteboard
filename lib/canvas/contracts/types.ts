/** What a snapshot write did: the new revision, or the revision that beat it. */
export type CanvasSnapshotWriteResult =
  { ok: true; revision: number } | { ok: false; currentRevision: number | null };
