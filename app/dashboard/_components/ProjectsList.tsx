import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Loading } from "@/components/Loading/Loading";
import { getSessionAccount } from "@/lib/account";
import { formatDay } from "@/lib/formatDate";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace-status";
import {
  listRecentWorkspaceItems,
  type RecentWorkspaceItem,
} from "@/lib/workspaces";
import { FileText, Frame, Folder } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CreateNewBoardDialog } from "./CreateNewBoardDialog";
import { BoardCard } from "./BoardCard";

const RECENT_LIMIT = 5;

export function ProjectsList() {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectsListInner />
    </Suspense>
  );
}

async function ProjectsListInner() {
  const account = await getSessionAccount();

  if (!account) return null;

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const items = await listRecentWorkspaceItems(
    session.user.id,
    activeTeam?.id ?? null,
    RECENT_LIMIT,
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon={
          <Folder height={64} width={64} className="text-primary" />
        }
        title={`No boards in ${accountName}`}
        description={
          activeTeam
            ? `Boards shared with ${activeTeam.name} will appear here.`
            : "You haven't created any personal boards yet."
        }
        action={
          <CreateNewBoardDialog size="sm" variant="outline" />
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">Latest in {accountName}</h2>
        <p className="text-sm text-muted-foreground">
          The {items.length} most recently updated{" "}
          {items.length === 1 ? "item" : "items"} across boards, docs and
          canvases.
        </p>
      </div>

      <ul aria-label="Latest items" className="flex flex-col gap-3">
        {items.map((item) =>
          item.type === "workspace" ? (
            <BoardCard
              key={item.key}
              board={{
                id: item.id,
                name: item.workspaceName,
                description: item.description,
                status: item.status,
                updatedAt: item.updatedAt,
              }}
            />
          ) : (
            <SurfaceCard key={item.key} item={item} />
          ),
        )}
      </ul>
    </div>
  );
}

/**
 * A doc or canvas is shown through the board that owns it: the surface has no
 * name of its own, and opening the row lands on the board.
 */
function SurfaceCard({ item }: { item: RecentWorkspaceItem }) {
  const isDoc = item.type === "doc";
  const Icon = isDoc ? FileText : Frame;
  const label = isDoc ? "Doc" : "Canvas";

  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40">
      <Link
        href={`/workspace/${item.workspaceId}`}
        className="flex min-w-0 items-center gap-3"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{item.workspaceName}</span>
          <span className="text-sm text-muted-foreground">
            {label} · updated {formatDay(item.updatedAt)}
          </span>
        </span>
      </Link>

      <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        {WORKSPACE_STATUS_LABELS[item.status]}
      </span>
    </li>
  );
}
