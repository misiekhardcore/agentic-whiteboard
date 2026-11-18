import { assertEntityId } from "./internals";

/** Supabase Realtime topic for workspace-level presence, chat and agent events. */
export function workspaceTopic(workspaceId: string): string {
  return `workspace:${assertEntityId("workspace id", workspaceId)}`;
}
