import { z } from "zod";

/**
 * The canvas snapshot as stored and as spoken between the app and the service.
 * Shallow on purpose: record contents belong to the engine, while `documents` is
 * what makes a snapshot loadable. `schema` is kept because the engine migrates a
 * stored snapshot from the version it was written at; without it every reload is
 * read as the oldest version and the records are mangled.
 */
export const canvasSnapshotSchema = z.object({
  /** The room's logical clock when the snapshot was taken. */
  clock: z.number().optional(),
  /** The clock value of the last document change. */
  documentClock: z.number().optional(),
  /** Every record, with the clock value it last changed at. */
  documents: z.array(
    z.object({
      lastChangedClock: z.number(),
      state: z.record(z.string(), z.unknown()),
    }),
  ),
  /** Deleted record ids and the clock value that deleted them. */
  tombstones: z.record(z.string(), z.number()).optional(),
  /** The clock value older deletions are no longer tracked from. */
  tombstoneHistoryStartsAtClock: z.number().optional(),
  /** The engine schema the records were written with; needed to migrate them. */
  schema: z.record(z.string(), z.unknown()).optional(),
});

/** The stored projection of a canvas room: the row's copy a new room starts from. */
export type CanvasSnapshot = z.infer<typeof canvasSnapshotSchema>;

/** The service names the revision it last saw, so a stale write is refused. */
export const canvasSnapshotWriteSchema = z.object({
  revision: z.number().int().min(0),
  snapshot: canvasSnapshotSchema,
});

export type CanvasSnapshotWrite = z.infer<typeof canvasSnapshotWriteSchema>;

/** The app's answer when a room asks for the snapshot it should start from. */
export const canvasSnapshotLoadSchema = z.object({
  revision: z.number().int().min(0),
  snapshot: canvasSnapshotSchema.nullable(),
});

export type CanvasSnapshotLoad = z.infer<typeof canvasSnapshotLoadSchema>;

/** The app's answer when a snapshot write landed, naming the new revision. */
export const canvasSnapshotSavedSchema = z.object({ revision: z.number().int().min(0) });

export type CanvasSnapshotSaved = z.infer<typeof canvasSnapshotSavedSchema>;

/** The app's answer when a write named a revision the row has already moved past. */
export const canvasSnapshotRefusedSchema = z.object({ currentRevision: z.number().int().min(0) });

export type CanvasSnapshotRefused = z.infer<typeof canvasSnapshotRefusedSchema>;
