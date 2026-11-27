import { resolveCanvasConfig } from "@/lib/canvas/config";
import { canvasConnectionUri } from "@/lib/canvas/room";
import { probeCanvasService } from "@/lib/canvas/service";
import { mintCanvasToken } from "@/lib/canvas/tokens";
import { getSessionAccount } from "@/lib/identity/account";
import { getWorkspaceForUser, workspaceWriteDecision } from "@/lib/workspace/access";

/**
 * The one connection attempt a browser is about to make. The workspace and the
 * permission come from the session and the workspace access check, never from
 * the request, and the token lives for a minute: a reconnect asks again, so a
 * stale token never travels.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const { workspaceId } = await params;

  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to open this canvas." }, { status: 401 });
  }

  const access = await getWorkspaceForUser(workspaceId, account.session.user.id);
  if (!access) {
    return Response.json({ error: "That workspace could not be found." }, { status: 404 });
  }

  const config = resolveCanvasConfig();
  if (!config || !(await probeCanvasService({ httpOrigin: config.httpOrigin }))) {
    return Response.json(
      { error: "The canvas service is not running for this deployment." },
      { status: 503 },
    );
  }

  const { permission, readOnly } = workspaceWriteDecision(access);

  const token = mintCanvasToken({
    userId: account.session.user.id,
    workspaceId: access.workspace.id,
    permission,
    readOnly,
    secret: config.serviceSecret,
  });

  return Response.json(
    {
      uri: canvasConnectionUri({
        serviceUrl: config.serviceUrl,
        workspaceId: access.workspace.id,
        token,
      }),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
