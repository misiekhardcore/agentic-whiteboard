import { isDocProjection, RoomOwnerError } from "@v2/contracts";
import type {
  ApplyInput,
  ApplyResult,
  RoomOwnerErrorCode,
  RoomOwnerPort,
  RoomRef,
  SaveResult,
  Snapshot,
} from "@v2/contracts";

import type { DocService } from "./doc-service";

type SnapshotBody = { revision?: unknown; content?: unknown };
type ApplyBody = { revision?: unknown; applied?: unknown };

function roomUrl(
  service: DocService,
  door: "snapshot" | "apply" | "save" | "revoke",
  room: RoomRef,
): string {
  return `${service.httpUrl}/${door}/${encodeURIComponent(room.id)}`;
}

async function errorFrom(
  response: Response,
  fallback: RoomOwnerErrorCode,
): Promise<RoomOwnerError> {
  let code = fallback;

  try {
    const body = (await response.json()) as { code?: unknown };
    if (
      body.code === "invalid-ops" ||
      body.code === "room-not-found" ||
      body.code === "room-revoked" ||
      body.code === "apply-refused"
    ) {
      code = body.code;
    }
  } catch {
    // A non-JSON refusal is still a refusal; the status is enough to report it.
  }

  return new RoomOwnerError(code, `The document service answered ${response.status}.`);
}

/**
 * The app's client for the document room owner. Content itself travels over
 * the browser's socket; this port is how the server reads the room, applies a
 * block batch once per request key and closes live sessions on archive.
 */
export function createDocRoomOwner(service: DocService | null): RoomOwnerPort {
  return {
    async snapshot(room: RoomRef): Promise<Snapshot> {
      if (service === null) {
        throw new RoomOwnerError("room-not-found", "The document service is not configured.");
      }

      const response = await fetch(roomUrl(service, "snapshot", room), {
        headers: { authorization: `Bearer ${service.secret}` },
        cache: "no-store",
      });

      if (!response.ok) throw await errorFrom(response, "room-not-found");

      const body = (await response.json()) as SnapshotBody;
      if (typeof body.revision !== "number") {
        throw new Error("The document service returned no revision.");
      }

      return {
        room,
        revision: `rev-${body.revision}`,
        content: isDocProjection(body.content) ? body.content : null,
      };
    },

    async apply(input: ApplyInput): Promise<ApplyResult> {
      if (service === null) {
        throw new RoomOwnerError("room-not-found", "The document service is not configured.");
      }

      const response = await fetch(roomUrl(service, "apply", input.room), {
        method: "POST",
        headers: {
          authorization: `Bearer ${service.secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          ops: input.ops,
        }),
        cache: "no-store",
      });

      if (!response.ok) throw await errorFrom(response, "apply-refused");

      const body = (await response.json()) as ApplyBody;
      if (typeof body.revision !== "number" || typeof body.applied !== "number") {
        throw new Error("The document service returned no apply result.");
      }

      return { revision: `rev-${body.revision}`, applied: body.applied };
    },

    async save(room: RoomRef): Promise<SaveResult> {
      if (service === null) {
        throw new RoomOwnerError("room-not-found", "The document service is not configured.");
      }

      const response = await fetch(roomUrl(service, "save", room), {
        method: "POST",
        headers: { authorization: `Bearer ${service.secret}` },
        cache: "no-store",
      });

      if (!response.ok) throw await errorFrom(response, "apply-refused");

      const body = (await response.json()) as { revision?: unknown };
      if (typeof body.revision !== "number") {
        throw new Error("The document service returned no revision.");
      }

      return { revision: `rev-${body.revision}` };
    },

    async revoke(room: RoomRef): Promise<void> {
      if (service === null) return;

      const response = await fetch(roomUrl(service, "revoke", room), {
        method: "POST",
        headers: { authorization: `Bearer ${service.secret}` },
        cache: "no-store",
      });

      if (!response.ok) throw await errorFrom(response, "apply-refused");
    },
  };
}
