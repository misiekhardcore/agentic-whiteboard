import { z } from "zod";

import { canvasSnapshotSchema } from "./canvasSnapshotSchema";

/** The service names the revision it last saw, so a stale write is refused. */
export const canvasSnapshotWriteSchema = z.object({
  revision: z.number().int().min(0),
  snapshot: canvasSnapshotSchema,
});
