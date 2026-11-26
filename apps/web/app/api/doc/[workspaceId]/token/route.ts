import { demoActor, getDependencies } from "@/src/server/dependencies";
import { resolveDocService } from "@/src/server/doc-service";
import { loadDocSession } from "@/src/server/doc-session";

/**
 * One connection attempt a browser is about to make. The workspace and the
 * read-only decision come from the session and the capability, never from the
 * request, and the token lives for a minute: a reconnect asks again, so a stale
 * token never travels and archiving revokes the live session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await params;

  const session = await loadDocSession({
    workspaceId,
    actor: demoActor,
    context: { actor: demoActor, ...getDependencies() },
    service: resolveDocService(),
  });

  if (session.state === "unavailable") {
    return Response.json({ error: session.message }, { status: 503 });
  }

  if (session.state === "refused") {
    return Response.json({ error: session.message }, { status: 404 });
  }

  return Response.json(session.connection, { headers: { "cache-control": "no-store" } });
}
