import { getDependencies } from "@/src/server/dependencies";
import { resolveDocService } from "@/src/server/doc-service";
import { loadDocSession } from "@/src/server/doc-session";
import { requireActor } from "@/src/server/identity/actor";

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
  const session = await requireActor();
  if (session === null) {
    return Response.json({ error: "Sign in to open this document." }, { status: 401 });
  }

  const { workspaceId } = await params;

  const docSession = await loadDocSession({
    workspaceId,
    actor: session.actor,
    context: { actor: session.actor, ...getDependencies() },
    service: resolveDocService(),
  });

  if (docSession.state === "unavailable") {
    return Response.json({ error: docSession.message }, { status: 503 });
  }

  if (docSession.state === "refused") {
    return Response.json({ error: docSession.message }, { status: 404 });
  }

  return Response.json(docSession.connection, { headers: { "cache-control": "no-store" } });
}
