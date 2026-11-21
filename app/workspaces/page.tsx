import { Button } from "@konopskidev/ui/components/button";
import { Folder } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RefreshOnChanges } from "@/components/Changes";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { CreateWorkspaceDialog } from "@/components/Workspaces/CreateWorkspaceDialog";
import { WorkspaceCard } from "@/components/Workspaces/WorkspaceCard";
import { getSessionAccount } from "@/lib/identity/account";
import { CHANGE_KEYS } from "@/lib/shared/changes";
import { routes, signInPath } from "@/lib/shared/routes";
import { listAccountWorkspaces } from "@/lib/workspace/queries";

export const metadata: Metadata = {
  title: "All workspaces",
};

// The list depends on the signed-in account, so it renders per request.
export const instant = false;

/**
 * Every active workspace in the selected account. The dashboard only shows the
 * latest handful of workspaces, docs and canvases; this page is the full list,
 * and it re-reads when `workspaces` or `account` change.
 */
export default async function WorkspacesPage() {
  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.workspaces));

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const workspaces = await listAccountWorkspaces(session.user.id, activeTeam?.id ?? null);

  return (
    <div className="stack">
      <RefreshOnChanges keys={[CHANGE_KEYS.workspaces, CHANGE_KEYS.account]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Every active workspace in {accountName}. The dashboard shows the latest five workspaces,
            docs and canvases.
          </p>
        </div>
        <CreateWorkspaceDialog size="sm" variant="outline" />
      </div>

      {workspaces.length === 0 ? (
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
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"} in this
            account.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </ul>
        </div>
      )}

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href={routes.dashboard}>← Back to dashboard</Link>
      </Button>
    </div>
  );
}
