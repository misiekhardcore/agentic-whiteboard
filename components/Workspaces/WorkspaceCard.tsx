import Link from "next/link";

import { AccountAvatar } from "@/components/AccountMenu/AccountMenuPopover/AccountAvatar";
import { formatDay } from "@/lib/shared/format-date";
import { routes } from "@/lib/shared/routes";
import { formatLastActivity } from "@/lib/workspace/presentation";
import type { WorkspaceCreator } from "@/lib/workspace/queries";
import { WORKSPACE_STATUS_LABELS, type WorkspaceStatus } from "@/lib/workspace/status";

import { WorkspaceCardMenu } from "./WorkspaceCardMenu";

type WorkspaceCardBase = {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  /** Null when the creator's row is gone; the card then states no person. */
  creator: WorkspaceCreator | null;
};

/**
 * A workspace as one of the two states a grid shows it in. The state decides the
 * timestamp the card carries and the operations its menu offers, so neither can
 * describe a workspace that no longer matches.
 */
export type WorkspaceCardWorkspace =
  | (WorkspaceCardBase & { archived: false; lastActivity: Date })
  | (WorkspaceCardBase & { archived: true; archivedAt: Date });

/**
 * A workspace in a grid: its name and description link to the workspace, the
 * footer carries its creator, and its management actions sit behind the overflow
 * menu. The board, the dashboard's latest list and the archive all render this
 * card, so the three stay identical. `showStage` is off on the board because the
 * column already names the stage.
 */
export function WorkspaceCard({
  workspace,
  showStage = true,
  as: Wrapper = "li",
}: {
  workspace: WorkspaceCardWorkspace;
  showStage?: boolean;
  /** The board wraps a sortable list item around the card, so it renders a div here. */
  as?: "li" | "div";
}) {
  return (
    <Wrapper className="flex h-full flex-col gap-3 card p-3 transition-colors hover:border-primary/40">
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
          archived={workspace.archived}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {workspace.archived
          ? `Archived ${formatDay(workspace.archivedAt)}`
          : `Last activity ${formatLastActivity(workspace.lastActivity, new Date())}`}
      </p>

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

        {showStage && (
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            {WORKSPACE_STATUS_LABELS[workspace.status]}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
