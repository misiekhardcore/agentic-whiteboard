import { Loading } from "@/components/Loading/Loading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import { Button } from "@konopskidev/ui/components/button";
import { getSessionAccount } from "@/lib/account";
import { formatDay } from "@/lib/formatDate";
import { restoreWorkspaceAction } from "@/lib/workspace-actions";
import { listArchivedWorkspaces } from "@/lib/workspaces";
import { Suspense } from "react";

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
  const workspaces = await listArchivedWorkspaces(
    session.user.id,
    activeTeam?.id ?? null,
  );

  if (workspaces.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Archived workspaces</CardTitle>
        <CardDescription>
          Restore a workspace to bring it back to the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{workspace.name}</p>
                <p className="text-xs text-muted-foreground">
                  Archived {formatDay(workspace.archivedAt)}
                </p>
              </div>
              <form action={restoreWorkspaceAction}>
                <input type="hidden" name="id" value={workspace.id} />
                <Button type="submit" variant="outline" size="sm">
                  Restore
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
