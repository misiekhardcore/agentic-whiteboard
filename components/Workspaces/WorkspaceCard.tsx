import Link from "next/link";

import { AccountAvatar } from "@/components/AccountMenu/AccountMenuPopover/AccountAvatar";
import { routes } from "@/lib/shared/routes";
import type { AccountWorkspace, WorkspaceCreator } from "@/lib/workspace/queries";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace/status";

import { WorkspaceCardMenu } from "./WorkspaceCardMenu";

/**
 * A workspace in a grid: its name and description link to the workspace, the
 * footer carries its creator and stage, and its management actions sit behind
 * the overflow menu. Used by the board, the dashboard's latest list and the
 * archive so all three stay identical.
 */
export function WorkspaceCard({
  workspace,
}: {
  workspace: AccountWorkspace & { creator?: WorkspaceCreator | null };
}) {
  return (
    <li className="flex h-full flex-col gap-3 card p-3 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <Link href={routes.workspace(workspace.id)} className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{workspace.name}</span>
          {workspace.description && (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {workspace.description}
            </span>
          )}
        </Link>

        <WorkspaceCardMenu
          id={workspace.id}
          name={workspace.name}
          description={workspace.description}
          status={workspace.status}
        />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex min-w-0 items-center gap-2">
          {workspace.creator && (
            <>
              <AccountAvatar
                name={workspace.creator.name}
                image={workspace.creator.image}
                size="sm"
              />
              <span className="truncate text-xs text-muted-foreground">
                {workspace.creator.name}
              </span>
            </>
          )}
        </span>

        <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          {WORKSPACE_STATUS_LABELS[workspace.status]}
        </span>
      </div>
    </li>
  );
}
