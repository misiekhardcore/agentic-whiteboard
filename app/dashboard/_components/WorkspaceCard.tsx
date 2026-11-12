import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { archiveWorkspaceAction } from "@/lib/workspace-actions";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace-status";
import type { AccountWorkspace } from "@/lib/workspaces";
import Link from "next/link";

import { EditWorkspaceDialog } from "./EditWorkspaceDialog";

/**
 * A workspace in a grid: its name and description link to the workspace, and
 * the footer carries the stage plus the management actions. Used by the
 * dashboard's latest list and by the all-workspaces page so both stay
 * identical.
 */
export function WorkspaceCard({ workspace }: { workspace: AccountWorkspace }) {
  return (
    <li className="card flex h-full flex-col gap-2 p-3 transition-colors hover:border-primary/40">
      <Link href={`/workspace/${workspace.id}`} className="flex flex-col gap-1">
        <span className="font-medium">{workspace.name}</span>
        {workspace.description && (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {workspace.description}
          </span>
        )}
      </Link>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          {WORKSPACE_STATUS_LABELS[workspace.status]}
        </span>

        <div className="flex items-center gap-1">
          <EditWorkspaceDialog
            id={workspace.id}
            name={workspace.name}
            description={workspace.description}
            status={workspace.status}
          />
          <ConfirmAction
            action={archiveWorkspaceAction}
            fields={{ id: workspace.id }}
            title={`Archive ${workspace.name}?`}
            description="The workspace leaves the dashboard and stops counting against your plan. Its documents, canvas and agent history are kept, and you can restore it at any time."
            confirmLabel="Archive workspace"
            pendingLabel="Archiving…"
            triggerLabel="Archive"
            triggerVariant="ghost"
          />
        </div>
      </div>
    </li>
  );
}
