import type { WorkspacePermission } from "@/lib/collab/contracts";

import { CANVAS_TOKEN_AUDIENCE, CANVAS_TOKEN_TTL_SECONDS } from "./constants";
import { signPayload } from "./internals";

/**
 * Mints the token a browser shows the canvas service when it joins a room.
 *
 * The token is requested for every connection attempt, carries the person, the
 * workspace and the read-only flag decided by the workspace access check, and
 * expires in a minute, so a leaked URL is not a standing key.
 */
export function mintCanvasToken({
  userId,
  workspaceId,
  permission,
  readOnly,
  secret,
  now = Date.now(),
  ttlSeconds = CANVAS_TOKEN_TTL_SECONDS,
}: {
  userId: string;
  workspaceId: string;
  permission: WorkspacePermission;
  readOnly: boolean;
  secret: string;
  now?: number;
  ttlSeconds?: number;
}): string {
  const issuedAt = Math.floor(now / 1000);

  return signPayload(
    {
      aud: CANVAS_TOKEN_AUDIENCE,
      sub: userId,
      workspaceId,
      permission,
      readOnly,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    },
    secret,
  );
}
