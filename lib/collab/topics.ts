import {
  WORKSPACE_SURFACES,
  type WorkspaceSurface,
} from "./contracts";

/**
 * Entities are cuid2/Better Auth ids: no colons, so they cannot forge another
 * workspace's topic or document name.
 */
const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const WORKSPACE_DOCUMENT_PATTERN =
  /^workspace:([A-Za-z0-9_-]{1,64}):(doc|canvas)$/;

export class CollabTopicError extends Error {
  constructor(label: string, value: string) {
    super(
      `Invalid ${label} "${value}". Collaboration ids must be 1-64 characters of letters, digits, hyphens or underscores.`,
    );
    this.name = "CollabTopicError";
  }
}

function assertEntityId(label: string, value: string): string {
  if (!ENTITY_ID_PATTERN.test(value)) {
    throw new CollabTopicError(label, value);
  }
  return value;
}

/** Supabase Realtime topic for workspace-level presence, chat and agent events. */
export function workspaceTopic(workspaceId: string): string {
  return `workspace:${assertEntityId("workspace id", workspaceId)}`;
}

/** Hocuspocus document name for a workspace's document surface. */
export function workspaceDocName(workspaceId: string): string {
  return `${workspaceTopic(workspaceId)}:doc`;
}

/** Hocuspocus document name for a workspace's canvas surface. */
export function workspaceCanvasName(workspaceId: string): string {
  return `${workspaceTopic(workspaceId)}:canvas`;
}

/** Supabase Realtime topic for the organization's team board. */
export function organizationBoardTopic(organizationId: string): string {
  return `org:${assertEntityId("organization id", organizationId)}:board`;
}

/**
 * Parses a Hocuspocus document name before auth/persistence touches a room.
 * Returns null for anything this app did not name.
 */
export function parseWorkspaceDocumentName(
  documentName: string,
): { workspaceId: string; surface: WorkspaceSurface } | null {
  const match = WORKSPACE_DOCUMENT_PATTERN.exec(documentName);
  if (!match) return null;

  const surface = match[2] as WorkspaceSurface;
  if (!WORKSPACE_SURFACES.includes(surface)) return null;

  return { workspaceId: match[1], surface };
}

export const AGENT_STATUS_EVENT = "agent.status" as const;
export const AGENT_MESSAGE_EVENT = "agent.message" as const;
export const WORKSPACE_UPDATED_EVENT = "workspace.updated" as const;
