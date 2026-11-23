import { FileText, Folder, Frame } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Loading } from "@/components/Loading/Loading";
import { CreateWorkspaceDialog } from "@/components/Workspaces/CreateWorkspaceDialog";
import { WorkspaceCard } from "@/components/Workspaces/WorkspaceCard";
import { getSessionAccount } from "@/lib/identity/account";
import { formatDay } from "@/lib/shared/format-date";
import { routes } from "@/lib/shared/routes";
import { listRecentWorkspaceItems, type RecentSurfaceEntry } from "@/lib/workspace/recent";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace/status";

const RECENT_LIMIT = 5;

export function ProjectsSection() {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectsSectionInner />
    </Suspense>
  );
}

async function ProjectsSectionInner() {
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
        icon={<Folder height={64} width={64} className="text-primary" />}
        title={`No workspaces in ${accountName}`}
        description={
          activeTeam
            ? `Workspaces shared with ${activeTeam.name} will appear here.`
            : "You haven't created any personal workspaces yet."
        }
        action={<CreateWorkspaceDialog size="sm" variant="outline" />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">Latest in {accountName}</h2>
        <p className="text-sm text-muted-foreground">
          The {items.length} most recently updated {items.length === 1 ? "item" : "items"} across
          workspaces, docs and canvases.
        </p>
      </div>

      <ul aria-label="Latest items" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) =>
          item.type === "workspace" ? (
            <WorkspaceCard
              key={item.key}
              workspace={{
                archived: false,
                id: item.id,
                name: item.workspaceName,
                description: item.description,
                status: item.status,
                creator: item.creator,
                lastActivity: item.lastActivity,
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
function SurfaceCard({ item }: { item: RecentSurfaceEntry }) {
  const isDoc = item.type === "doc";
  const Icon = isDoc ? FileText : Frame;
  const label = isDoc ? "Doc" : "Canvas";

  return (
    <li className="flex flex-col gap-2 card p-3 transition-colors hover:border-primary/40">
      <Link href={routes.workspace(item.workspaceId)} className="flex min-w-0 items-center gap-2">
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
