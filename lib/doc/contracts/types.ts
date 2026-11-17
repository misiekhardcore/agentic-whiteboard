/**
 * A document is one of a workspace's two content surfaces. Its `workspaceId` is
 * unique in the schema, so a workspace has at most one document and a document
 * has no name of its own: it is always presented, linked and counted through the
 * workspace that owns it.
 *
 * The type carries no content. The list, the dashboard and (later) the editor
 * read the surface; the document body belongs to the collaboration gateway,
 * which owns the Yjs state and the snapshot rule.
 */
export type DocSurface = {
  id: string;
  workspaceId: string;
  updatedAt: Date;
};
