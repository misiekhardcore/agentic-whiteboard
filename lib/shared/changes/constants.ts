/**
 * The datasets the interface subscribes to. They are coarse on purpose: one key
 * per thing a page shows, not one per row, so a capability declares what a
 * person will see change rather than which route it happened to render.
 */
export const CHANGE_KEYS = {
  /** Every workspace list: recent items, all workspaces, archived. */
  workspaces: "workspaces",
  /** The conversation switcher, the history dialog and a conversation's label. */
  conversations: "conversations",
  /** The account shell: profile names, membership, roles, invitations, plan. */
  account: "account",
  /** A person's preferences that a page renders with, such as read aloud. */
  settings: "settings",
} as const;

export type ChangeKey = (typeof CHANGE_KEYS)[keyof typeof CHANGE_KEYS];

/** The one event a change is broadcast under. */
export const CHANGE_EVENT = "data.changed";

/** Every change topic starts here, so one channel cannot be confused with another feature's. */
export const CHANGE_TOPIC_PREFIX = "app:";
