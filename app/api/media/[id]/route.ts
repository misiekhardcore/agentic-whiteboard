import { getSessionAccount } from "@/lib/identity/account";
import { resolveMediaConfig } from "@/lib/media/config";
import { mediaReadable } from "@/lib/media/rules";
import { findMediaById } from "@/lib/media/service";
import { createSupabaseMediaStorage } from "@/lib/media/storage";
import { getWorkspaceForUser } from "@/lib/workspace/access";

/**
 * Serves a stored object to someone allowed to see it, through the app rather
 * than a storage URL: the access check runs on every read, so revoking access
 * takes effect immediately and the browser never holds a key to the bucket.
 *
 * A refusal is a 404 for the same reason the workspace pages use one: it never
 * confirms that an id exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to open this file." }, { status: 401 });
  }

  const row = await findMediaById(id);
  if (!row) {
    return Response.json({ error: "That file could not be found." }, { status: 404 });
  }

  const access = row.workspaceId
    ? await getWorkspaceForUser(row.workspaceId, account.session.user.id)
    : null;

  const readable = mediaReadable({
    media: row,
    viewer: {
      userId: account.session.user.id,
      canReadWorkspace: access !== null,
    },
  });
  if (!readable) {
    return Response.json({ error: "That file could not be found." }, { status: 404 });
  }

  const config = resolveMediaConfig();
  if (!config) {
    return Response.json({ error: "This deployment does not store media." }, { status: 503 });
  }

  const stored = await createSupabaseMediaStorage(config).get(row.storageKey);
  if (!stored) {
    return Response.json({ error: "That file could not be found." }, { status: 404 });
  }

  return new Response(stored.body, {
    headers: {
      // The row's type, not the bucket's: what was accepted on upload is what
      // the browser is told, so a stored object cannot pass itself off.
      "content-type": row.mimeType,
      "content-disposition": "inline",
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff",
      // Access can be revoked at any time, so a shared cache must not keep it.
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
