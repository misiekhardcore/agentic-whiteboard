import type { CanvasSnapshot } from "@/lib/canvas/contracts";
import type { WorkspaceSurface } from "@/lib/collab/contracts";

/**
 * One content surface of a workspace as the lists read it: its identity, the
 * workspace that owns it and which surface it is — never its body.
 *
 * A document and a canvas are rows in different tables, but they are one thing
 * to every reader outside this context: a workspace has surfaces, and archiving
 * the workspace removes them all.
 */
export type ContentSurface = {
  id: string;
  workspaceId: string;
  surface: WorkspaceSurface;
  updatedAt: Date;
};

/**
 * A canvas as its room reads it: the stored projection and the revision a
 * snapshot write names as the check it expects.
 */
export type StoredCanvas = {
  revision: number;
  snapshot: CanvasSnapshot | null;
};
