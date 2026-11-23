import type { WorkspacePermission } from "@/lib/collab/contracts";

/**
 * Whether this person's writes to a workspace's content must be refused. An
 * archived workspace is read-only for everyone and a view-only role never
 * writes, so the archive rule wins over the permission.
 *
 * The canvas room and the media upload share this answer: both write into the
 * same workspace and would otherwise carry a copy of the same rule.
 */
export function workspaceReadOnly({
  permission,
  archived,
}: {
  permission: WorkspacePermission;
  archived: boolean;
}): boolean {
  return archived || permission === "view";
}
