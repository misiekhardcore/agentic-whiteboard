import { z } from "zod";

/**
 * The shape a snapshot must have before the app stores it. Deliberately
 * shallow: record contents belong to the engine, while `documents` is what
 * makes a snapshot loadable at all. `schema` is kept because the engine needs
 * the version it was written at to migrate a stored snapshot; without it every
 * reload is read as the oldest version and the records are mangled.
 */
export const canvasSnapshotSchema = z.object({
  clock: z.number().optional(),
  documentClock: z.number().optional(),
  documents: z.array(
    z.object({
      lastChangedClock: z.number(),
      state: z.record(z.string(), z.unknown()),
    }),
  ),
  tombstones: z.record(z.string(), z.number()).optional(),
  tombstoneHistoryStartsAtClock: z.number().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
});
