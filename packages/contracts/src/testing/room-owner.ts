import type { JsonValue } from "../json";
import { RoomOwnerError } from "../room-owner";
import type {
  ApplyInput,
  ApplyResult,
  ContentOp,
  RoomOwnerPort,
  RoomRef,
  Snapshot,
} from "../room-owner";

export type SeedRoom = {
  room: RoomRef;
  content: JsonValue;
  /** Defaults to `rev-1`; a fixture may choose a starting revision. */
  revision?: string;
};

type StoredRoom = {
  room: RoomRef;
  content: JsonValue;
  revision: string;
  revoked: boolean;
  applied: Map<string, ApplyResult>;
};

export type InMemoryRoomOwner = RoomOwnerPort;

const roomKey = (room: RoomRef): string => `${room.kind}:${room.id}`;

const isReplaceOp = (op: ContentOp): boolean => op.kind === "replace";

function nextRevision(revision: string): string {
  const match = /^rev-(\d+)$/.exec(revision);
  return match === null ? `${revision}+1` : `rev-${Number(match[1]) + 1}`;
}

/** Runs synchronous room logic and turns a thrown refusal into a rejection. */
function settled<Value>(run: () => Value): Promise<Value> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * The reference room owner for this slice. It is deliberately small, but it is
 * not a stub: it records idempotency keys inside the room, applies a batch
 * atomically and refuses writes after revoke, exactly as a real room owner must.
 */
export function createInMemoryRoomOwner(
  options: { rooms?: readonly SeedRoom[] } = {},
): InMemoryRoomOwner {
  const rooms = new Map<string, StoredRoom>();

  for (const seed of options.rooms ?? []) {
    rooms.set(roomKey(seed.room), {
      room: seed.room,
      content: structuredClone(seed.content),
      revision: seed.revision ?? "rev-1",
      revoked: false,
      applied: new Map(),
    });
  }

  function requireRoom(room: RoomRef): StoredRoom {
    const stored = rooms.get(roomKey(room));
    if (stored === undefined) {
      throw new RoomOwnerError("room-not-found", `No room ${roomKey(room)} is held`);
    }
    return stored;
  }

  return {
    snapshot(room: RoomRef): Promise<Snapshot> {
      return settled(() => {
        const stored = requireRoom(room);
        return {
          room: stored.room,
          revision: stored.revision,
          content: structuredClone(stored.content),
        };
      });
    },

    apply(input: ApplyInput): Promise<ApplyResult> {
      return settled(() => {
        const stored = requireRoom(input.room);

        if (stored.revoked) {
          throw new RoomOwnerError("room-revoked", `Room ${roomKey(input.room)} was revoked`);
        }

        const replay = stored.applied.get(input.idempotencyKey);
        if (replay !== undefined) {
          return { revision: replay.revision, applied: 0 };
        }

        if (input.ops.length === 0) {
          return { revision: stored.revision, applied: 0 };
        }

        if (!input.ops.every(isReplaceOp)) {
          throw new RoomOwnerError(
            "invalid-ops",
            "The batch contains an operation this room cannot apply",
          );
        }

        for (const op of input.ops) {
          stored.content = structuredClone(op.payload);
        }
        stored.revision = nextRevision(stored.revision);

        const result: ApplyResult = { revision: stored.revision, applied: input.ops.length };
        stored.applied.set(input.idempotencyKey, result);
        return result;
      });
    },

    revoke(room: RoomRef): Promise<void> {
      return settled(() => {
        requireRoom(room).revoked = true;
      });
    },
  };
}
