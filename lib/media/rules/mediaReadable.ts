/**
 * Whether this person may read a stored object.
 *
 * A file attached to a workspace is part of that workspace, so the workspace's
 * own access check decides - including for the person who uploaded it, who
 * loses the file when they lose the workspace. A file attached to nothing yet
 * (a later conversation attachment) is only its uploader's.
 */
export function mediaReadable({
  media,
  viewer,
}: {
  media: { uploadedByUserId: string; workspaceId: string | null };
  viewer: { userId: string; canReadWorkspace: boolean };
}): boolean {
  if (media.workspaceId) return viewer.canReadWorkspace;

  return media.uploadedByUserId === viewer.userId;
}
