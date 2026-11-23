import { getSessionAccount } from "@/lib/identity/account";
import { resolveMediaConfig } from "@/lib/media/config";
import { mediaUploadRefusal } from "@/lib/media/rules";
import { createMedia } from "@/lib/media/service";
import { createSupabaseMediaStorage } from "@/lib/media/storage";

/**
 * Stores one file against a workspace. The file is attached to a workspace on
 * purpose: that attachment is what lets the workspace's own access check and
 * archive rule decide who may read it afterwards, so a file that belongs to
 * nothing cannot be uploaded yet.
 *
 * The bytes never touch the database. The object goes to the deployment's
 * storage bucket and the row keeps its identity.
 */
export async function POST(request: Request): Promise<Response> {
  const account = await getSessionAccount();
  if (!account) {
    return Response.json({ error: "Sign in to add a file." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "That upload could not be read." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Attach the file to store." }, { status: 400 });
  }

  const config = resolveMediaConfig();
  if (!config) {
    return Response.json({ error: "This deployment does not store media." }, { status: 503 });
  }

  const refusal = mediaUploadRefusal({ contentType: file.type, byteSize: file.size });
  if (refusal) {
    return Response.json({ error: refusal }, { status: 400 });
  }

  const created = await createMedia({
    storage: createSupabaseMediaStorage(config),
    uploadedByUserId: account.session.user.id,
    contentType: file.type,
    byteSize: file.size,
    body: await file.arrayBuffer(),
  });

  return Response.json(
    { id: created.id, url: `/api/media/${created.id}` },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
