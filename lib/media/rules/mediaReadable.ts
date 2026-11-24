/**
 * Whether this person may read a stored file. Its uploader may always read it,
 * so a personal file stays theirs even after they switch accounts. Otherwise
 * the file follows its account: every member of the organization it was
 * uploaded into can open it, on any board that references it.
 */
export function mediaReadable({
  media,
  viewer,
}: {
  media: { uploadedByUserId: string; orgId: string | null };
  viewer: { userId: string; organizationIds: readonly string[] };
}): boolean {
  if (media.uploadedByUserId === viewer.userId) return true;

  return media.orgId !== null && viewer.organizationIds.includes(media.orgId);
}
