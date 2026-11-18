import type { AccountActor } from "@/lib/identity/actor";

import type { WorkspaceOverview } from "../contracts";

import { listAccountWorkspaces } from "./listAccountWorkspaces";
import { listArchivedWorkspaces } from "./listArchivedWorkspaces";

/**
 * The account's workspaces, newest first. Archived ones are opt-in: they are
 * hidden from the dashboard and the plan meter, so a caller that wants them
 * says so.
 */
export async function listWorkspacesFor(
  actor: Pick<AccountActor, "userId" | "organizationId">,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<WorkspaceOverview[]> {
  const [active, archived] = await Promise.all([
    listAccountWorkspaces(actor.userId, actor.organizationId),
    includeArchived
      ? listArchivedWorkspaces(actor.userId, actor.organizationId)
      : Promise.resolve([]),
  ]);

  return [
    ...active.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      status: workspace.status,
      archived: false,
    })),
    ...archived.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      status: workspace.status,
      archived: true,
    })),
  ];
}
