/**
 * Whether this person may delete a stored file. Only the person who put it
 * there may take it away: a file is shared with a whole account, and letting a
 * teammate delete it would break boards the deleter never opened.
 */
export function mediaDeletable({
  media,
  requesterId,
}: {
  media: { uploadedByUserId: string };
  requesterId: string;
}): boolean {
  return media.uploadedByUserId === requesterId;
}
