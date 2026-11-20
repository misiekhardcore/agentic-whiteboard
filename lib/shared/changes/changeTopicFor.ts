import type { Change, ChangeChannels } from "./types";

/**
 * Where one change goes: an account-scoped change to the active organization,
 * everyone else's to the person's own channel — which is also the personal
 * account's channel, so one subscription covers both.
 */
export function changeTopicFor(change: Change, channels: ChangeChannels): string {
  return change.scope === "account" && channels.organization
    ? channels.organization
    : channels.person;
}
