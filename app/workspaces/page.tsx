import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Button } from "@konopskidev/ui/components/button";
import { Folder } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceCard } from "@/app/dashboard/_components/WorkspaceCard";
import { CreateWorkspaceDialog } from "@/app/dashboard/_components/CreateWorkspaceDialog";
import { getSessionAccount } from "@/lib/account";
import { listAccountWorkspaces } from "@/lib/workspaces";

export const metadata = {
  title: "All workspaces",
};

// The list depends on the signed-in account, so it renders per request.
export const instant = false;

/**
 * Every active workspace in the selected account. The dashboard only shows the
 * latest handful of workspaces, docs and canvases; this page is the full list,
 * and mutations revalidate both paths.
 */
export default async function WorkspacesPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/sign-in?redirectTo=/workspaces");

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const workspaces = await listAccountWorkspaces(
    session.user.id,
    activeTeam?.id ?? null,
  );

  return (
    <div className="stack">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Every active workspace in {accountName}. The dashboard shows the
            latest five workspaces, docs and canvases.
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
            {workspaces.length}{" "}
            {workspaces.length === 1 ? "workspace" : "workspaces"} in this
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
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>
    </div>
  );
}
