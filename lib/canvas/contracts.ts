/**
 * A canvas is the other content surface of a workspace: one per workspace, no
 * name of its own, and reachable only through the workspace that owns it.
 *
 * It is a separate context from the document rather than a `kind` column because
 * the two differ where it will matter: a document carries Yjs state and is
 * edited as text, the canvas is edited as shapes. They share a shape today, not
 * a reason to change.
 */
export type CanvasSurface = {
  id: string;
  workspaceId: string;
  updatedAt: Date;
};
