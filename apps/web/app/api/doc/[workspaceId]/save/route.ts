import { docSave, invoke } from "@v2/capabilities";

import { demoActor, getDependencies } from "@/src/server/dependencies";
import { statusOf } from "@/src/server/refusal-status";

const NO_STORE = { "cache-control": "no-store" };

/**
 * A person's save. The capability authorizes and the room owner counts pending
 * changes and writes the snapshot before answering, so the revision this route
 * returns is already durable.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await params;

  const result = await invoke(docSave, { actor: demoActor, ...getDependencies() }, { workspaceId });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: statusOf(result.code), headers: NO_STORE },
    );
  }

  return Response.json({ ok: true, revision: result.revision }, { headers: NO_STORE });
}
