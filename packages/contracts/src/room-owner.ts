import type { Actor } from "./actor";
import type { JsonValue } from "./json";

export type RoomKind = "doc" | "canvas";

/** A content surface scoped to its account. */
export type RoomRef = {
  kind: RoomKind;
  id: string;
  accountId: string;
};

/** A read-only view of a live surface. Never raw CRDT bytes. */
export type Snapshot = {
  room: RoomRef;
  /** Opaque, monotonic per room: compare it, do not parse it. */
  revision: string;
  content: JsonValue;
};

/** One semantic intent, not a whole-document replacement. */
export type ContentOp = {
  kind: string;
  payload: JsonValue;
};

export type ApplyInput = {
  room: RoomRef;
  actor: Actor;
  /**
   * `(runId, opKey)` for an agent, a request id for a person. It is recorded in
   * the room with the operations, so a retry applies nothing.
   */
  idempotencyKey: string;
  ops: readonly ContentOp[];
};

export type ApplyResult = {
  revision: string;
  applied: number;
};

/**
 * The one way anything reads or writes content. The real implementation is a
 * remote room owner; tests use the in-memory fake, and both are held to the
 * conformance suite.
 */
export type RoomOwnerPort = {
  snapshot(room: RoomRef): Promise<Snapshot>;
  apply(input: ApplyInput): Promise<ApplyResult>;
  revoke(room: RoomRef): Promise<void>;
};

export type RoomOwnerErrorCode =
  "room-not-found" | "room-revoked" | "invalid-ops" | "apply-refused";

export class RoomOwnerError extends Error {
  readonly code: RoomOwnerErrorCode;

  constructor(code: RoomOwnerErrorCode, message: string) {
    super(message);
    this.name = "RoomOwnerError";
    this.code = code;
  }
}
