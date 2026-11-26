import type { Actor } from "./actor";
import type { ContentOp } from "./room-owner";

/**
 * The block vocabulary. A block has an identity that survives edits; document
 * operations name that identity and never an offset, because the same anchors
 * also have to survive a person typing above them.
 */
export type DocBlockKind = "paragraph" | "heading";

/** A block as the room owner projects it, with who last wrote it. */
export type DocBlock = {
  id: string;
  kind: string;
  level: number | null;
  text: string;
  updatedBy: string | null;
};

/** What a caller asks a room owner to write. Attribution is the owner's job. */
export type DocBlockWrite = {
  id: string;
  kind: DocBlockKind;
  level: number | null;
  text: string;
};

export type DocProjection = { blocks: DocBlock[] };

export type AppendBlockOp = {
  kind: "append-block";
  payload: { block: DocBlockWrite };
};

export type ReplaceBlockOp = {
  kind: "replace-block";
  payload: { blockId: string; block: DocBlockWrite };
};

export type DocContentOp = AppendBlockOp | ReplaceBlockOp;

/** An identity a URL, a comment anchor or an operation may carry. */
export const BLOCK_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

/** A request key: `(runId, opKey)` for an agent, a request id for a person. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

const MIN_HEADING_LEVEL = 1;
const MAX_HEADING_LEVEL = 6;

/** How the document records who wrote a block. */
export function actorReference(actor: Actor): string {
  return actor.type === "user" ? `user:${actor.userId}` : `agent:${actor.runId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** The service authenticates its caller, so it still validates the actor shape. */
export function isActor(value: unknown): value is Actor {
  if (!isRecord(value)) return false;
  if (value.type === "user") {
    return (
      isNonEmptyString(value.userId) &&
      isNonEmptyString(value.accountId) &&
      value.runId === undefined
    );
  }
  if (value.type === "agent") {
    return (
      isNonEmptyString(value.runId) &&
      isNonEmptyString(value.accountId) &&
      isNonEmptyString(value.requestedByUserId)
    );
  }
  return false;
}

function headingLevel(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < MIN_HEADING_LEVEL || value > MAX_HEADING_LEVEL) return null;
  return value;
}

/** Validates and normalizes the block a caller wants a room owner to write. */
export function normalizeDocBlockWrite(value: unknown): DocBlockWrite | null {
  if (!isRecord(value)) return null;

  const { id, kind, text } = value;
  if (typeof id !== "string" || !BLOCK_ID_PATTERN.test(id)) return null;
  if (kind !== "paragraph" && kind !== "heading") return null;
  if (typeof text !== "string" || text.length === 0) return null;

  if (kind === "paragraph") {
    return { id, kind, level: null, text };
  }

  const level = headingLevel(value.level);
  return level === null ? null : { id, kind, level, text };
}

/** Reads one content operation, or `null` when this room cannot apply it. */
export function readDocContentOp(value: ContentOp): DocContentOp | null {
  if (!isRecord(value.payload)) return null;

  if (value.kind === "append-block") {
    const block = normalizeDocBlockWrite(value.payload.block);
    return block === null ? null : { kind: "append-block", payload: { block } };
  }

  if (value.kind === "replace-block") {
    const block = normalizeDocBlockWrite(value.payload.block);
    if (block === null) return null;
    if (value.payload.blockId !== block.id) return null;

    return { kind: "replace-block", payload: { blockId: block.id, block } };
  }

  return null;
}

function isDocBlock(value: unknown): value is DocBlock {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    BLOCK_ID_PATTERN.test(value.id) &&
    isNonEmptyString(value.kind) &&
    (value.level === null || headingLevel(value.level) !== null) &&
    typeof value.text === "string" &&
    (value.updatedBy === null || isNonEmptyString(value.updatedBy))
  );
}

/** A projection the app may trust without importing the content engine. */
export function isDocProjection(value: unknown): value is DocProjection {
  return (
    isRecord(value) &&
    Array.isArray(value.blocks) &&
    value.blocks.every((block) => isDocBlock(block))
  );
}
