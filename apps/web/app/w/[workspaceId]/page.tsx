import { readAgentHealth } from "@/src/server/agent-health";
import { demoActor, getDependencies } from "@/src/server/dependencies";
import { loadWorkspaceView } from "@/src/server/workspace-view";
import type { WorkspaceView } from "@/src/server/workspace-view";

export const dynamic = "force-dynamic";

type ViewState = WorkspaceView | { state: "unavailable"; message: string };

export default async function WorkspacePage(props: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await props.params;

  const viewPromise = loadWorkspaceView(workspaceId, demoActor, getDependencies()).catch(
    (): ViewState => ({ state: "unavailable", message: "The workspace could not be read." }),
  );

  const [view, agent] = await Promise.all([viewPromise, readAgentHealth()]);

  return (
    <main className="page">
      <p className="eyebrow">Workspace</p>

      {view.state === "ready" ? (
        <>
          <h1>{view.title}</h1>
          <p className="meta">
            Snapshot revision <code>{view.revision}</code>
          </p>
          <p className="muted">
            Title and revision are read through <code>workspace.read</code>, which asks the room
            owner behind the port. Nothing on this page holds a second copy.
          </p>
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
