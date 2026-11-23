import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import { Archive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RefreshOnChanges } from "@/components/Changes";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { ArchivedWorkspaceGrid } from "@/components/Workspaces/ArchivedWorkspaceGrid";
import { getSessionAccount } from "@/lib/identity/account";
import { CHANGE_KEYS } from "@/lib/shared/changes";
import { routes, signInPath } from "@/lib/shared/routes";
import { listArchivedWorkspaces } from "@/lib/workspace/queries";

export const metadata: Metadata = {
  title: "Archived workspaces",
};

// The list depends on the signed-in account, so it renders per request.
export const instant = false;

/**
 * Every archived workspace in the selected account. Archiving is a soft delete:
 * the workspace is out of the dashboard and the plan meter, and this is the one
 * place that shows it while it waits to be restored or deleted for good. The
 * restore and delete actions publish the workspace lists this page reads.
 */
export default async function ArchivePage() {
  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.workspacesArchive));

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const workspaces = await listArchivedWorkspaces(session.user.id, activeTeam?.id ?? null);

  return (
    <div className="stack">
      <RefreshOnChanges keys={[CHANGE_KEYS.workspaces]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Archived workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Workspaces archived in {accountName}. They stay out of the dashboard and the plan meter
            until you restore one; deleting removes it for good.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={routes.workspaces}>All workspaces</Link>
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={<Archive height={64} width={64} className="text-primary" />}
          title={`Nothing archived in ${accountName}`}
          description="Archiving a workspace hides it from the dashboard and frees its plan slot. It waits here until you restore or delete it."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={routes.workspaces}>Browse workspaces</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {workspaces.length} archived {workspaces.length === 1 ? "workspace" : "workspaces"}
            </CardTitle>
            <CardDescription>
              Restore one to bring it back to the dashboard, or delete it permanently once you are
              sure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArchivedWorkspaceGrid workspaces={workspaces} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
