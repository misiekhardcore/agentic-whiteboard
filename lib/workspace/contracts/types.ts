import type { CapabilityFailure, CapabilitySuccess } from "@/lib/capabilities/define";

import type { WorkspaceStatus } from "../status";

/**
 * What a workspace looks like outside the context. Plain data with no server
 * imports, so the dashboard, the agent's tool output and the capability schema
 * describe the same shape.
 */
/** A workspace in a mutation result: enough to identify it. */
export type WorkspaceSummary = {
  id: string;
  name: string;
  status: WorkspaceStatus;
};

/** A workspace in a list: enough to identify it, nothing document-shaped. */
export type WorkspaceOverview = {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  archived: boolean;
};

/** One workspace as the detail view (and the agent) reads it. */
export type WorkspaceDetail = {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  archivedAt: Date | null;
};

/** What a caller sends to change some of a workspace's fields. */
export type WorkspaceUpdateInput = {
  id: string;
  name?: string;
  description?: string | null;
  status?: string;
};

/**
 * A move names the stage and the two cards the dragged card lands between. The
 * caller never sends a position: the server derives it from the neighbours it
 * can see in that column.
 */
export type WorkspaceMoveInput = {
  id: string;
  status: WorkspaceStatus;
  previousId?: string;
  nextId?: string;
};

export type WorkspaceMutationResult =
  CapabilitySuccess<{ workspace: WorkspaceSummary }> | CapabilityFailure;

export type WorkspaceReadResult =
  CapabilitySuccess<{ workspace: WorkspaceDetail }> | CapabilityFailure;
