import { assertEntityId } from "./internals";

/** Supabase Realtime topic for the organization's team board. */
export function organizationBoardTopic(organizationId: string): string {
  return `org:${assertEntityId("organization id", organizationId)}:board`;
}
