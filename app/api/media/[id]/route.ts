import { getSessionAccount } from "@/lib/identity/account";
import { mediaDeletable, mediaReadable } from "@/lib/media/rules";
import { deleteMedia, findMediaById, mediaStore } from "@/lib/media/service";

/**
 * Serves a stored file to someone allowed to see it, through the app rather
 * than a storage URL: the access check runs on every read, so revoking a
 * membership takes effect immediately and the browser never holds a key to the
 * bucket.
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
  const readable =
    row !== null &&
    mediaReadable({
      media: row,
      viewer: {
        userId: account.session.user.id,
        organizationIds: account.teams.map((team) => team.id),
      },
    });
  if (!row || !readable) {
    return Response.json({ error: "That file could not be found." }, { status: 404 });
  }

  const store = mediaStore();
  if (!store.ok) {
    return Response.json({ error: store.error }, { status: 503 });
  }

  const stored = await store.storage.get(row.storageKey);
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

/**
 * Removes a file nobody should see again: its object leaves the bucket and the
 * row leaves the database, so the address stops resolving at once. Only the
 * uploader may ask; a teammate deleting it would break boards they never saw.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to remove this file." }, { status: 401 });
  }

  const row = await findMediaById(id);
  if (!row || !mediaDeletable({ media: row, requesterId: account.session.user.id })) {
    return Response.json({ error: "That file could not be found." }, { status: 404 });
  }

  const store = mediaStore();
  if (!store.ok) {
    return Response.json({ error: store.error }, { status: 503 });
  }

  await deleteMedia({ storage: store.storage, file: row });

  return new Response(null, { status: 204 });
}
