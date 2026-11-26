import { RoomOwnerError } from "@v2/contracts";
import type { RoomOwnerPort, RoomRef, Snapshot } from "@v2/contracts";

import type { DocService } from "./doc-service";

type SnapshotBody = { revision?: unknown };

/**
 * The app's client for the document room owner. Content itself travels over
 * the browser's socket; this port is how the server reads the room's revision
 * and how an archive closes its live sessions. The apply half arrives with the
 * server write path, so it refuses rather than pretending to have written.
 */
export function createDocRoomOwner(service: DocService | null): RoomOwnerPort {
  return {
    async snapshot(room: RoomRef): Promise<Snapshot> {
      if (service === null) {
        throw new RoomOwnerError("room-not-found", "The document service is not configured.");
      }

      const response = await fetch(`${service.httpUrl}/snapshot/${encodeURIComponent(room.id)}`, {
        headers: { authorization: `Bearer ${service.secret}` },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new RoomOwnerError(
          "room-not-found",
          `The document service answered ${response.status}.`,
        );
      }

      const body = (await response.json()) as SnapshotBody;
      if (typeof body.revision !== "number") {
        throw new Error("The document service returned no revision.");
      }

      return { room, revision: `rev-${body.revision}`, content: null };
    },

    apply() {
      return Promise.reject(
        new RoomOwnerError("apply-refused", "Server-side document writes land in a later slice."),
      );
    },

    async revoke(room: RoomRef): Promise<void> {
      if (service === null) return;

      const response = await fetch(`${service.httpUrl}/revoke/${encodeURIComponent(room.id)}`, {
        method: "POST",
        headers: { authorization: `Bearer ${service.secret}` },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new RoomOwnerError(
          "apply-refused",
          `The document service could not close the room (${response.status}).`,
        );
      }
    },
  };
}
