import { Alert, AlertDescription, AlertTitle } from "@konopskidev/ui/components/alert";
import { Badge } from "@konopskidev/ui/components/badge";
import { Card } from "@konopskidev/ui/components/card";
import { DEMO_ARCHIVED_WORKSPACE, DEMO_WORKSPACE } from "@v2/db/demo";
import Link from "next/link";

import { DocEditor } from "./_components/DocEditor";
import { DocNotice } from "./_components/DocNotice";

import { readAgentHealth } from "@/src/server/agent-health";
import { demoActor, getDependencies } from "@/src/server/dependencies";
import { probeDocService, resolveDocService } from "@/src/server/doc-service";
import { loadWorkspaceView } from "@/src/server/workspace-view";
import type { WorkspaceView } from "@/src/server/workspace-view";

export const dynamic = "force-dynamic";

type ViewState = WorkspaceView | { state: "unavailable"; message: string };

export default async function WorkspacePage(props: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await props.params;
  const docService = resolveDocService();

  const viewPromise = loadWorkspaceView(workspaceId, demoActor, getDependencies()).catch(
    (): ViewState => ({ state: "unavailable", message: "The workspace could not be read." }),
  );

  const [view, agent, docServiceUp] = await Promise.all([
    viewPromise,
    readAgentHealth(),
    probeDocService(docService),
  ]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:py-12">
      {view.state === "ready" ? (
        <>
          <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Workspace
              </p>
              <h1 className="font-display text-h1">{view.title}</h1>
            </div>

            {view.revision === null ? (
              <Badge variant="destructive">Document service unavailable</Badge>
            ) : (
              <Badge variant="outline" className="font-mono">
                Snapshot revision <span className="text-muted-foreground">{view.revision}</span>
              </Badge>
            )}
          </header>

          <div className="flex flex-1 flex-col gap-5 pt-6">
            {view.readOnly ? (
              <Alert variant="destructive" className="banner">
                <AlertTitle>This workspace is archived</AlertTitle>
                <AlertDescription>
                  The document stays readable, but the room refuses every write until the workspace
                  is restored.
                </AlertDescription>
              </Alert>
            ) : null}

            <section aria-label="Document">
              <Card className="doc-shell overflow-hidden p-0">
                {docService !== null && docServiceUp ? (
                  <DocEditor workspaceId={workspaceId} readOnly={view.readOnly} />
                ) : (
                  <DocNotice
                    title="The document is unavailable"
                    description="This deployment has no document service running. Everything else in this workspace still works."
                  />
                )}
              </Card>
            </section>

            {workspaceId === DEMO_WORKSPACE.id ? (
              <p className="text-sm text-muted-foreground">
                Read-only path:{" "}
                <Link
                  href={`/w/${DEMO_ARCHIVED_WORKSPACE.id}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  open an archived workspace
                </Link>
                .
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <header className="flex flex-col gap-1.5 border-b border-border pb-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Workspace
            </p>
            <h1 className="font-display text-h1">
              {view.state === "refused" && view.code === "not-found" ? "Not found" : "Unavailable"}
            </h1>
          </header>
          <p className="pt-6 text-muted-foreground">{view.message}</p>
        </>
      )}

      <footer className="mt-10 flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Agent service</span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={
              agent.status === "up"
                ? "size-2 rounded-full bg-success"
                : "size-2 rounded-full bg-destructive"
            }
          />
          {agent.status === "up" ? `up · ${agent.service}` : `down · ${agent.detail}`}
        </span>
      </footer>
    </main>
  );
}
