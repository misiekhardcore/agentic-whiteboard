import { Button } from "@konopskidev/ui/components/button";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { formatDay } from "@/lib/shared/format-date";
import { deleteWorkspaceAction, restoreWorkspaceAction } from "@/lib/workspace/actions";
import type { ArchivedWorkspace } from "@/lib/workspace/queries";

/**
 * One row per archived workspace, with the only two operations an archived
 * workspace offers: bring it back, or remove it for good. The dashboard card and
 * the archive page render this same list, so the actions and their wording
 * cannot drift between the two surfaces.
 */
export function ArchivedWorkspaceList({ workspaces }: { workspaces: ArchivedWorkspace[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {workspaces.map((workspace) => (
        <li
          key={workspace.id}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{workspace.name}</p>
            <p className="text-xs text-muted-foreground">
              Archived {formatDay(workspace.archivedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <form action={restoreWorkspaceAction}>
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <Button type="submit" variant="outline" size="sm">
                Restore
              </Button>
            </form>
            <ConfirmAction
              action={deleteWorkspaceAction}
              fields={{ workspaceId: workspace.id }}
              title={`Delete ${workspace.name} permanently?`}
              description="The workspace and its documents, canvas and agent history are removed for good. This cannot be undone."
              confirmLabel="Delete workspace"
              pendingLabel="Deleting…"
              triggerLabel="Delete"
              triggerVariant="ghost"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
