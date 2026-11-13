/**
 * Collaboration contracts shared by the agent layer, the future Hocuspocus
 * gateway, and the Supabase Realtime events. These are intentionally free of
 * server imports so client components can use the event and actor types.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const WORKSPACE_SURFACES = ["doc", "canvas"] as const;
export type WorkspaceSurface = (typeof WORKSPACE_SURFACES)[number];

export const WORKSPACE_PERMISSIONS = ["view", "edit"] as const;
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

export const AGENT_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

/**
 * Mirrors the AI SDK's `UIMessage["role"]`, upper-cased to match the Postgres
 * enum convention. Tool calls and results are `tool-*` parts on an assistant
 * message, so they are content, not a role of their own.
 */
export const AGENT_MESSAGE_ROLES = ["SYSTEM", "USER", "ASSISTANT"] as const;
export type AgentMessageRole = (typeof AGENT_MESSAGE_ROLES)[number];

export const AGENT_ACTOR_TYPES = ["USER", "AGENT"] as const;
export type AgentActorType = (typeof AGENT_ACTOR_TYPES)[number];

/** A human acting with their own authenticated session. */
export type UserActor = {
  type: "user";
  userId: string;
};

/**
 * The agent acts as its own participant, but always on behalf of the user who
 * requested the run. The gateway verifies both before applying a mutation.
 */
export type AgentActor = {
  type: "agent";
  runId: string;
  requestedByUserId: string;
};

export type ActorRef = UserActor | AgentActor;

/**
 * A read-only projection of a collaborative surface. The gateway owns the
 * conversion from the live Y.Doc; consumers (including the model) never see
 * binary Yjs state.
 */
export type WorkspaceSnapshot = {
  workspaceId: string;
  surface: WorkspaceSurface;
  /** Opaque revision/state-vector marker for diagnostics and optimistic reads. */
  revision: string;
  content: JsonValue;
};

/**
 * Semantic intent, not a whole-document replacement. The gateway validates the
 * kind and payload against the live document and applies the batch in one Yjs
 * transaction, so concurrent human edits are preserved.
 */
export type WorkspaceMutation = {
  /** Tool-call id or other stable id, used for idempotent retries. */
  id: string;
  kind: string;
  payload: JsonValue;
};

export type MutationResult = {
  revision: string;
  applied: number;
  /** The resulting projection when the caller needs to reason about it. */
  snapshot?: WorkspaceSnapshot;
};

/**
 * The only way the agent may read or change a shared surface. The real
 * implementation will call the Hocuspocus room owner; tests can use a fake.
 */
export type WorkspaceGateway = {
  snapshot(input: { workspaceId: string; surface: WorkspaceSurface }): Promise<WorkspaceSnapshot>;
  mutate(input: {
    workspaceId: string;
    surface: WorkspaceSurface;
    actor: ActorRef;
    /** Stable per tool call, e.g. `${runId}:${toolCallId}`. */
    idempotencyKey: string;
    mutations: WorkspaceMutation[];
  }): Promise<MutationResult>;
};

/** Claims the future collaboration-token endpoint will mint. */
export type CollaborationClaims = {
  /** Better Auth user id (text, not a UUID). */
  sub: string;
  workspaceId: string;
  permission: WorkspacePermission;
  actorType: AgentActorType;
  /** Present when actorType is AGENT. */
  runId?: string;
};

export type AgentStatusEvent = {
  type: "agent.status";
  workspaceId: string;
  runId: string;
  status: AgentRunStatus;
  requestedByUserId: string;
  /** Set while a tool is executing, for the "Buffy is…" label. */
  toolName?: string;
  at: string;
};

export type AgentMessageEvent = {
  type: "agent.message";
  workspaceId: string;
  runId: string;
  messageId: string;
  role: AgentMessageRole;
  at: string;
};

export type WorkspaceUpdatedEvent = {
  type: "workspace.updated";
  workspaceId: string;
  at: string;
};

/**
 * Ephemeral Supabase Realtime payloads. Document bytes never travel here;
 * Hocuspocus owns CRDT sync. Authoritative chat/run history lives in Postgres.
 */
export type WorkspaceRealtimeEvent = AgentStatusEvent | AgentMessageEvent | WorkspaceUpdatedEvent;
