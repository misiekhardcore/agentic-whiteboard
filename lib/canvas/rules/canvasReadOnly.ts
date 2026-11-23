import type { WorkspacePermission } from "@/lib/collab/contracts";

/**
 * Whether the room must refuse writes from this connection. An archived
 * workspace is read-only for everyone, and a role that may only view never
 * writes, so the archive rule wins over the permission.
 */
export function canvasReadOnly({
  permission,
  archived,
}: {
  permission: WorkspacePermission;
  archived: boolean;
}): boolean {
  return archived || permission === "view";
}
