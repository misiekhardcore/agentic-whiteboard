import { getDependencies } from "@/src/server/dependencies";
import { insertTemplateBlock } from "@/src/server/doc-write";
import { requireActor } from "@/src/server/identity/actor";
import { statusOf } from "@/src/server/refusal-status";

const NO_STORE = { "cache-control": "no-store" };

/**
 * The temporary control's door. It accepts only a request key: the block comes
 * from the server, and the write itself runs through the same `doc.append`
 * capability an agent will call. The service credential never reaches the
 * browser.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const session = await requireActor();
  if (session === null) {
    return Response.json({ error: "Sign in to change this document." }, { status: 401 });
  }

  const { workspaceId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Expected a JSON request key." },
      { status: 400, headers: NO_STORE },
    );
  }

  const idempotencyKey =
    typeof body === "object" && body !== null && "idempotencyKey" in body
      ? body.idempotencyKey
      : null;

  if (typeof idempotencyKey !== "string") {
    return Response.json({ error: "Expected a request key." }, { status: 400, headers: NO_STORE });
  }

  const result = await insertTemplateBlock({
    workspaceId,
    idempotencyKey,
    context: { actor: session.actor, ...getDependencies() },
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, code: result.code },
      { status: statusOf(result.code), headers: NO_STORE },
    );
  }

  return Response.json(
    {
      ok: true,
      blockId: result.blockId,
      revision: result.revision,
      applied: result.applied,
    },
    { headers: NO_STORE },
  );
}
