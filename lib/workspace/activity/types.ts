import type { AccountActor } from "@/lib/identity/actor";

import type {
  WORKSPACE_ACTIVITY_ACTOR_TYPES,
  WORKSPACE_ACTIVITY_KINDS,
  WORKSPACE_ACTIVITY_SURFACES,
} from "./constants";

export type WorkspaceActivityKind = (typeof WORKSPACE_ACTIVITY_KINDS)[number];

export type WorkspaceActivitySurface = (typeof WORKSPACE_ACTIVITY_SURFACES)[number];

export type WorkspaceActivityActorType = (typeof WORKSPACE_ACTIVITY_ACTOR_TYPES)[number];

/** What a change recorded, in the shape its kind allows. Never workspace content. */
export type WorkspaceActivityDetails = {
  /** The value before the change: a name, a description or a stage; null when absent. */
  from?: string | null;
  /** The value after it; null means the description was cleared. */
  to?: string | null;
};

/** One change a writer appends, before its workspace and actor are attached. */
export type WorkspaceActivityChange = {
  surface: WorkspaceActivitySurface;
  kind: WorkspaceActivityKind;
  details: WorkspaceActivityDetails;
};

/** The person a write is requested by, and whether the agent made it for them. */
export type WorkspaceRequester = AccountActor & { actorType: WorkspaceActivityActorType };

/** One recorded activity as its history reads it. */
export type WorkspaceActivityEntry = {
  id: string;
  surface: WorkspaceActivitySurface;
  kind: WorkspaceActivityKind;
  actorType: WorkspaceActivityActorType;
  actorUserId: string;
  /** The requester's display name, so the history can name who asked. */
  actorName: string | null;
  details: WorkspaceActivityDetails;
  /** Insertion order, which breaks a tie when rows share an instant. */
  sequence: number;
  createdAt: Date;
};

/** The two values a page stops at, so older activity can be loaded after it. */
export type WorkspaceActivityCursor = {
  createdAt: Date;
  /** Unique and monotonic, so it breaks a tie between rows of one instant. */
  sequence: number;
};

/** One bounded page of a workspace's history and where to continue from. */
export type WorkspaceActivityPage = {
  activity: WorkspaceActivityEntry[];
  nextCursor: WorkspaceActivityCursor | null;
};

/** A row waiting to be appended, with the workspace and actor it belongs to. */
export type NewWorkspaceActivity = {
  workspaceId: string;
  surface: WorkspaceActivitySurface;
  kind: WorkspaceActivityKind;
  actorType: WorkspaceActivityActorType;
  actorUserId: string;
  details: WorkspaceActivityDetails;
};
