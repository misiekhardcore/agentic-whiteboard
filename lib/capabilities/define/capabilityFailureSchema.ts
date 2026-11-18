import { z } from "zod";

/** The success half is per capability; the failure half is always this shape. */
export const capabilityFailureSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  hint: z.string().optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  limitReached: z.boolean().optional(),
});
