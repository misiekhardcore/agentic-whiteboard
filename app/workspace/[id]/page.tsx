import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionAccount } from "@/lib/account";
import { formatDay } from "@/lib/formatDate";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace-status";
import { getWorkspaceForUser } from "@/lib/workspaces";

// The id comes from the URL and access depends on the session, so this route
// renders per request.
export const instant = false;

/**
 * A workspace is only reachable through the account that owns it: the creator for a
 * personal workspace, a member of the organization for a shared one. Anything else
 * is a 404, so the route never confirms that an id exists.
 *
 * The editor is not built yet; this page is the gate the editor will render
 * behind, not a workspace surface of its own.
 */
export default async function WorkspacePage({ params }: PageProps<"/workspace/[id]">) {
  const { id } = await params;

  const account = await getSessionAccount();
  if (!account) redirect(`/sign-in?redirectTo=/workspace/${id}`);

  const access = await getWorkspaceForUser(id, account.session.user.id);
  if (!access) notFound();

  const { workspace } = access;

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-h2 font-semibold">{workspace.name}</h1>
            <Badge variant="outline">{WORKSPACE_STATUS_LABELS[workspace.status]}</Badge>
            {workspace.archivedAt && <Badge variant="secondary">Archived</Badge>}
          </div>
          {workspace.description && (
            <p className="text-sm text-muted-foreground">{workspace.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Last updated {formatDay(workspace.updatedAt)}
            {access.kind === "organization" ? " · Shared with your team" : ""}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>The workspace editor is on its way</CardTitle>
            <CardDescription>
              This workspace is ready. Documents, the canvas and the agent will open here once
              collaboration lands.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Manage your workspaces</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
