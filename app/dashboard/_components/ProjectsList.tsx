import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Loading } from "@/components/Loading/Loading";
import { getSessionAccount } from "@/lib/account";
import { formatDay } from "@/lib/formatDate";
import { routes } from "@/lib/routes";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace-status";
import {
  listRecentWorkspaceItems,
  type RecentWorkspaceItem,
} from "@/lib/workspaces";
import { FileText, Frame, Folder } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { WorkspaceCard } from "./WorkspaceCard";

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
        title={`No workspaces in ${accountName}`}
        description={
          activeTeam
            ? `Workspaces shared with ${activeTeam.name} will appear here.`
            : "You haven't created any personal workspaces yet."
        }
        action={
          <CreateWorkspaceDialog size="sm" variant="outline" />
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
          {items.length === 1 ? "item" : "items"} across workspaces, docs and
          canvases.
        </p>
      </div>

      <ul
        aria-label="Latest items"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {items.map((item) =>
          item.type === "workspace" ? (
            <WorkspaceCard
              key={item.key}
              workspace={{
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
 * A doc or canvas is shown through the workspace that owns it: the surface has
 * no name of its own, and opening the card lands on the workspace.
 */
function SurfaceCard({ item }: { item: RecentWorkspaceItem }) {
  const isDoc = item.type === "doc";
  const Icon = isDoc ? FileText : Frame;
  const label = isDoc ? "Doc" : "Canvas";

  return (
    <li className="card flex flex-col gap-2 p-3 transition-colors hover:border-primary/40">
      <Link
        href={routes.workspace(item.workspaceId)}
        className="flex min-w-0 items-center gap-2"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{item.workspaceName}</span>
      </Link>

      <p className="text-sm text-muted-foreground">
        {label} · updated {formatDay(item.updatedAt)}
      </p>

      <span className="mt-auto font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        {WORKSPACE_STATUS_LABELS[item.status]}
      </span>
    </li>
  );
}
