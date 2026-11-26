import { BLOCK_ID_PATTERN, IDEMPOTENCY_KEY_PATTERN, RoomOwnerError } from "@v2/contracts";
import type { Refusal } from "@v2/contracts";
import { z } from "zod";

import { refusal } from "../result";

/** The block a caller wants written; the owner adds who wrote it. */
export const blockWriteSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paragraph"),
    level: z.null().default(null),
    text: z.string().min(1).max(10_000),
  }),
  z.object({
    kind: z.literal("heading"),
    level: z.number().int().min(1).max(6),
    text: z.string().min(1).max(10_000),
  }),
]);

export const idempotencyKeySchema = z.string().regex(IDEMPOTENCY_KEY_PATTERN);
export const blockIdSchema = z.string().regex(BLOCK_ID_PATTERN);

/**
 * A block id is derived from the request key, so a retry addresses the same
 * block even if the first response was lost. The owner records the key too,
 * which is what makes the retry apply nothing.
 */
export function blockIdFor(idempotencyKey: string): string {
  return `block_${idempotencyKey}`;
}

/** A write the room owner refused is a value the caller can read and retry. */
export function roomRefusal(error: unknown): Refusal {
  if (error instanceof RoomOwnerError) {
    switch (error.code) {
      case "invalid-ops":
        return refusal("invalid-input", error.message);
      case "room-revoked":
        return refusal("read-only", "This workspace is archived and the document refuses writes.");
      case "room-not-found":
        return refusal("unavailable", "The document is unavailable right now.");
      case "apply-refused":
        return refusal("unavailable", "The document service refused the write.");
    }
  }

  return refusal("unavailable", "The document could not be written right now.");
}
