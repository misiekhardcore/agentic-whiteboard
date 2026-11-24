import { resolveCanvasConfig } from "@/lib/canvas/config";
import {
  type CanvasSnapshotLoad,
  type CanvasSnapshotRefused,
  type CanvasSnapshotSaved,
  canvasSnapshotWriteSchema,
} from "@/lib/canvas/contracts";
import { authorizeCanvasServiceRequest } from "@/lib/canvas/service";
import { readCanvasSnapshot, saveCanvasSnapshot } from "@/lib/workspace/surfaces";

/**
 * The canvas service's own door: it reads the snapshot a room starts from and
 * pushes the debounced snapshot a room produces. Authorization is the shared
 * service secret, and the revision in the body is the write's optimistic check,
 * so a slow room cannot replace a newer one.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await params;

  const unauthorized = authorizeService(request);
  if (unauthorized) return unauthorized;

  const stored = await readCanvasSnapshot(workspaceId);
  if (!stored) {
    return Response.json({ error: "That workspace has no canvas." }, { status: 404 });
  }

  const body: CanvasSnapshotLoad = stored;

  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await params;

  const unauthorized = authorizeService(request);
  if (unauthorized) return unauthorized;

  const payload: unknown = await request.json().catch(() => null);
  const parsed = canvasSnapshotWriteSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "That is not a canvas snapshot." }, { status: 400 });
  }

  const result = await saveCanvasSnapshot({
    workspaceId,
    expectedRevision: parsed.data.revision,
    snapshot: parsed.data.snapshot,
  });

  if (result.ok) {
    const saved: CanvasSnapshotSaved = { revision: result.revision };

    return Response.json(saved, { headers: { "cache-control": "no-store" } });
  }

  if (result.currentRevision === null) {
    return Response.json({ error: "That workspace has no canvas." }, { status: 404 });
  }

  const refused: CanvasSnapshotRefused = { currentRevision: result.currentRevision };

  return Response.json(refused, { status: 409, headers: { "cache-control": "no-store" } });
}

/** The refusal for a caller other than the canvas service, or `null` to continue. */
function authorizeService(request: Request): Response | null {
  const config = resolveCanvasConfig();
  if (!config) {
    return Response.json(
      { error: "The canvas service is not configured for this deployment." },
      { status: 503 },
    );
  }

  if (
    !authorizeCanvasServiceRequest({
      authorization: request.headers.get("authorization"),
      secret: config.serviceSecret,
    })
  ) {
    return Response.json({ error: "That call is not from the canvas service." }, { status: 401 });
  }

  return null;
}
