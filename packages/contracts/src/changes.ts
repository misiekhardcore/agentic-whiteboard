/**
 * One dataset a successful call changed. The browser re-reads through its own
 * authorization; a change is a hint, never a row.
 */
export type Change = {
  key: string;
  scope: "person" | "account";
};
