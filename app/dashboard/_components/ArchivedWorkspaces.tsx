import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import Link from "next/link";
import { Suspense } from "react";

import { Loading } from "@/components/Loading/Loading";
import { getSessionAccount } from "@/lib/identity/account";
import { routes } from "@/lib/shared/routes";
import { listArchivedWorkspaces } from "@/lib/workspace/queries";

import { ArchivedWorkspaceList } from "./ArchivedWorkspaceList";

/**
 * Archived workspaces stay restorable without cluttering the dashboard. Only
 * the active account's workspaces are listed, and the card disappears entirely
 * when there is nothing archived.
 */
export function ArchivedWorkspaces() {
  return (
    <Suspense fallback={<Loading />}>
      <ArchivedWorkspacesInner />
    </Suspense>
  );
}

async function ArchivedWorkspacesInner() {
  const account = await getSessionAccount();

  if (!account) return null;

  const { activeTeam, session } = account;
  const workspaces = await listArchivedWorkspaces(session.user.id, activeTeam?.id ?? null);

  if (workspaces.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Archived workspaces</CardTitle>
        <CardDescription>
          Restore a workspace to bring it back to the dashboard, or delete it permanently.{" "}
          <Link href={routes.dashboardArchive} className="underline underline-offset-4">
            View all archived
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ArchivedWorkspaceList workspaces={workspaces} />
      </CardContent>
    </Card>
  );
}
