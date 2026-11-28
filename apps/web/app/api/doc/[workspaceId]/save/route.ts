import { docSave, invoke } from "@v2/capabilities";

import { getDependencies } from "@/src/server/dependencies";
import { requireActor } from "@/src/server/identity/actor";
import { statusOf } from "@/src/server/refusal-status";

const NO_STORE = { "cache-control": "no-store" };

/**
 * A person's save. The capability authorizes and the room owner counts pending
 * changes and writes the snapshot before answering, so the revision this route
 * returns is already durable.
 *
 * The account is the one this request's session names. A page left open under
 * another account names a workspace that account cannot reach, so the save is
 * refused as not-found before the room owner is asked to do anything.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const session = await requireActor();
  if (session === null) {
    return Response.json({ error: "Sign in to save this document." }, { status: 401 });
  }

  const { workspaceId } = await params;

  const result = await invoke(
    docSave,
    { actor: session.actor, ...getDependencies() },
    { workspaceId },
  );

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: statusOf(result.code), headers: NO_STORE },
    );
  }

  return Response.json({ ok: true, revision: result.revision }, { headers: NO_STORE });
}
