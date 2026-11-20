import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RefreshOnChanges } from "@/components/Changes";
import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { getSessionAccount } from "@/lib/identity/account";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";
import { formatDay } from "@/lib/shared/format-date";
import { routes, signInPath } from "@/lib/shared/routes";
import { getWorkspaceForUser } from "@/lib/workspace/access";
import {
  archiveWorkspaceAction,
  deleteWorkspaceAction,
  restoreWorkspaceAction,
} from "@/lib/workspace/actions";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace/status";

/** The id is never echoed into a title, and the route stays out of search. */
export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

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
  if (!account) redirect(signInPath(routes.workspace(id)));

  const access = await getWorkspaceForUser(id, account.session.user.id);
  if (!access) notFound();

  const { workspace } = access;

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <RefreshOnChanges keys={[workspaceChangeKey(workspace.id), CHANGE_KEYS.workspaces]} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href={routes.dashboard}
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
              <Link href={routes.dashboard}>Manage your workspaces</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage this workspace</CardTitle>
            <CardDescription>
              {workspace.archivedAt
                ? "This workspace is archived: it is out of the dashboard and the plan meter. Restore it, or delete it for good."
                : "Archive the workspace to hide it from the dashboard and free its plan slot; its contents are kept and it can be restored from the archive."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {workspace.archivedAt ? (
              <>
                <form action={restoreWorkspaceAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Restore
                  </Button>
                </form>
                <ConfirmAction
                  action={deleteWorkspaceAction}
                  fields={{ workspaceId: workspace.id }}
                  title={`Delete ${workspace.name} permanently?`}
                  description="The workspace and its documents, canvas and agent history are removed for good. This cannot be undone."
                  confirmLabel="Delete workspace"
                  pendingLabel="Deleting…"
                  triggerLabel="Delete"
                />
              </>
            ) : (
              <ConfirmAction
                action={archiveWorkspaceAction}
                fields={{ workspaceId: workspace.id }}
                title={`Archive ${workspace.name}?`}
                description="The workspace leaves the dashboard and stops counting against your plan. Its documents, canvas and agent history are kept, and you can restore it at any time."
                confirmLabel="Archive workspace"
                pendingLabel="Archiving…"
                triggerLabel="Archive"
                triggerVariant="outline"
                confirmVariant="default"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
