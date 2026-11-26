import { docConnection, invoke } from "@v2/capabilities";
import type { CapabilityContext } from "@v2/capabilities";
import { mintRoomToken, ROOM_TOKEN_TTL_SECONDS } from "@v2/contracts";
import type { Actor, RefusalCode } from "@v2/contracts";

import { probeDocService } from "./doc-service";
import type { DocService, FetchLike } from "./doc-service";

export type DocConnection = {
  url: string;
  token: string;
  documentName: string;
  readOnly: boolean;
  expiresAt: number;
};

export type DocSession =
  | { state: "ready"; connection: DocConnection }
  | { state: "unavailable"; message: string }
  | { state: "refused"; code: RefusalCode; message: string };

/**
 * One connection attempt: the capability authorizes the actor and answers the
 * read-only question, the app signs those claims, and the room owner verifies
 * them again. A token is minted per attempt, so a leaked address is not a
 * standing key and an archived workspace cannot be written by an old tab.
 */
export async function loadDocSession({
  workspaceId,
  actor,
  context,
  service,
  fetchImpl = fetch,
  now = Date.now(),
}: {
  workspaceId: string;
  actor: Actor;
  context: CapabilityContext;
  service: DocService | null;
  fetchImpl?: FetchLike;
  now?: number;
}): Promise<DocSession> {
  if (service === null) {
    return {
      state: "unavailable",
      message: "The document service is not running for this deployment.",
    };
  }

  if (!(await probeDocService(service, fetchImpl))) {
    return {
      state: "unavailable",
      message: "The document service is not answering right now.",
    };
  }

  const result = await invoke(docConnection, context, { workspaceId });
  if (!result.ok) {
    return { state: "refused", code: result.code, message: result.error };
  }

  const token = mintRoomToken({
    audience: "doc",
    userId: userIdOf(actor),
    roomId: result.documentName,
    accountId: actor.accountId,
    permission: result.readOnly ? "read" : "write",
    readOnly: result.readOnly,
    secret: service.secret,
    now,
  });

  return {
    state: "ready",
    connection: {
      url: service.wsUrl,
      token,
      documentName: result.documentName,
      readOnly: result.readOnly,
      expiresAt: Math.floor(now / 1000) + ROOM_TOKEN_TTL_SECONDS,
    },
  };
}

function userIdOf(actor: Actor): string {
  return actor.type === "user" ? actor.userId : actor.requestedByUserId;
}
