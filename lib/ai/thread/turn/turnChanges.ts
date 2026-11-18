import { type Change, CHANGE_KEYS } from "@/lib/shared/changes";

/**
 * What one prompt turn changes in the interface. A new prompt is a row the
 * usage meter counts and a conversation the switcher lists, newest first; a
 * continuation (a retry or an approval answer) reuses a prompt already counted
 * and touches neither.
 */
export function turnChanges(continuing: boolean): Change[] {
  if (continuing) return [];

  return [
    { key: CHANGE_KEYS.conversations, scope: "person" },
    { key: CHANGE_KEYS.account, scope: "person" },
  ];
}
