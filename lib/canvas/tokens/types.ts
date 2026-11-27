import type { WorkspacePermission } from "@/lib/collab/contracts";

/**
 * What a canvas connection token proves: the person, the workspace, what they
 * may do there and whether the room must treat the session as read-only.
 *
 * `expiresAt` is a Unix time in seconds. A token is minted per connection
 * attempt, so an expired one is never refreshed in place.
 */
export type CanvasConnectionClaims = {
  userId: string;
  workspaceId: string;
  permission: WorkspacePermission;
  readOnly: boolean;
  expiresAt: number;
};
