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
    <main className="page">
      <p className="eyebrow">Workspace</p>

      {view.state === "ready" ? (
        <>
          <h1>{view.title}</h1>
          <p className="meta">
            {view.revision === null ? (
              <>Document service unavailable</>
            ) : (
              <>
                Snapshot revision <code>{view.revision}</code>
              </>
            )}
          </p>

          {view.readOnly ? (
            <p className="banner">
              This workspace is archived. The document stays readable, but the room refuses every
              write until the workspace is restored.
            </p>
          ) : null}

          <section className="document" aria-label="Document">
            {docService !== null && docServiceUp ? (
              <DocEditor workspaceId={workspaceId} readOnly={view.readOnly} />
            ) : (
              <DocNotice
                title="The document is unavailable"
                description="This deployment has no document service running. Everything else in this workspace still works."
              />
            )}
          </section>

          {workspaceId === DEMO_WORKSPACE.id ? (
            <p className="muted demo-link">
              Read-only path:{" "}
              <Link href={`/w/${DEMO_ARCHIVED_WORKSPACE.id}`}>open an archived workspace</Link>.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <h1>
            {view.state === "refused" && view.code === "not-found" ? "Not found" : "Unavailable"}
          </h1>
          <p className="muted">{view.message}</p>
        </>
      )}

      <footer className="footer">
        <span>Agent service</span>
        <span className={agent.status === "up" ? "status up" : "status down"}>
          {agent.status === "up" ? `up · ${agent.service}` : `down · ${agent.detail}`}
        </span>
      </footer>
    </main>
  );
}
