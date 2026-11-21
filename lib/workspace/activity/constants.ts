import type { WorkspaceActivityActorType, WorkspaceActivitySurface } from "./types";

/** Where a change happened: the workspace row itself, or one of its content surfaces. */
export const WORKSPACE_ACTIVITY_SURFACES = ["WORKSPACE", "DOC", "CANVAS"] as const;

/**
 * The named change each kind records. A rename and a description change are
 * separate kinds because a reader wants to know which one happened.
 */
export const WORKSPACE_ACTIVITY_KINDS = [
  "CREATED",
  "RENAMED",
  "DESCRIBED",
  "STAGE_MOVED",
  "ARCHIVED",
  "RESTORED",
  "DOC_SAVED",
  "CANVAS_SAVED",
] as const;

export const WORKSPACE_ACTIVITY_ACTOR_TYPES = ["PERSON", "AGENT"] as const;

export const WORKSPACE_ACTIVITY_SURFACE_LABELS: Record<WorkspaceActivitySurface, string> = {
  WORKSPACE: "Workspace",
  DOC: "Document",
  CANVAS: "Canvas",
};

export const WORKSPACE_ACTIVITY_ACTOR_LABELS: Record<WorkspaceActivityActorType, string> = {
  PERSON: "Person",
  AGENT: "Agent",
};

/** How many entries one history page reads before offering "load older". */
export const WORKSPACE_ACTIVITY_PAGE_SIZE = 20;
