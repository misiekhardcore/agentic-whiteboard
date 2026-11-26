/**
 * The workspace this slice renders. It is deliberately a known, seeded row:
 * accounts and workspace creation arrive in later slices, and the page needs
 * something to read until then.
 */
export type DemoWorkspace = {
  id: string;
  accountId: string;
  name: string;
  docRoomId: string;
};

export const DEMO_WORKSPACE: DemoWorkspace = {
  id: "ws_demo",
  accountId: "acct_demo",
  name: "Demo workspace",
  docRoomId: "doc_demo",
};
