import { Button } from "@konopskidev/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RefreshOnChanges } from "@/components/Changes";
import { getSessionAccount } from "@/lib/identity/account";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";
import { routes, signInPath } from "@/lib/shared/routes";
import { getWorkspaceForUser } from "@/lib/workspace/access";
import {
  decodeActivityCursor,
  encodeActivityCursor,
  groupActivityByDay,
  WORKSPACE_ACTIVITY_ACTOR_LABELS,
  WORKSPACE_ACTIVITY_SURFACE_LABELS,
  type WorkspaceActivityEntry,
} from "@/lib/workspace/activity";
import { listWorkspaceActivity } from "@/lib/workspace/queries";
import { describeActivity } from "@/lib/workspace/rules";

/** The id is never echoed into a title, and the route stays out of search. */
export const metadata: Metadata = {
  title: "Workspace activity",
  robots: { index: false, follow: false },
};

// The id comes from the URL and access depends on the session, so this route
// renders per request.
export const instant = false;

/**
 * A workspace's history, newest first, grouped by the day it happened. It is
 * authorized by the same read as the workspace itself, so the two can never
 * disagree about who may look; the page reads one bounded page and links to the
 * next rather than loading everything.
 */
export default async function WorkspaceActivityPage({
  params,
  searchParams,
}: PageProps<"/workspaces/[id]/activity">) {
  const { id } = await params;
  const { before } = await searchParams;

  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.workspaceActivity(id)));

  const access = await getWorkspaceForUser(id, account.session.user.id);
  if (!access) notFound();

  const { workspace } = access;
  const cursor = decodeActivityCursor(typeof before === "string" ? before : "");
  const page = await listWorkspaceActivity(workspace.id, { before: cursor });
  const days = groupActivityByDay(page.activity);

  return (
    <div className="flex w-full justify-center">
      <RefreshOnChanges keys={[workspaceChangeKey(workspace.id), CHANGE_KEYS.workspaces]} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href={routes.workspace(workspace.id)}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Back to {workspace.name}
          </Link>
          <h1 className="font-display text-h2 font-semibold">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Everything that happened to {workspace.name}, newest first.
          </p>
        </div>

        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          days.map((group) => (
            <section key={group.day} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {group.day}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm">{describeActivity(entry)}</span>
                    <span className="text-xs text-muted-foreground">{entryMeta(entry)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {page.nextCursor && (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link
              href={`${routes.workspaceActivity(workspace.id)}?before=${encodeURIComponent(
                encodeActivityCursor(page.nextCursor),
              )}`}
            >
              Load older activity
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** The surface, who asked for the change and when, on one line. */
function entryMeta(entry: WorkspaceActivityEntry): string {
  const actor =
    entry.actorType === "AGENT"
      ? `${WORKSPACE_ACTIVITY_ACTOR_LABELS.AGENT}, asked by ${entry.actorName ?? "a person"}`
      : (entry.actorName ?? WORKSPACE_ACTIVITY_ACTOR_LABELS.PERSON);

  const time = entry.createdAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return `${WORKSPACE_ACTIVITY_SURFACE_LABELS[entry.surface]} · ${actor} · ${time} UTC`;
}
