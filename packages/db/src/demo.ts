/**
 * The workspaces this slice renders. They are deliberately known, seeded rows:
 * accounts and workspace creation arrive in later slices, and the page needs
 * something to read until then. One is archived so the read-only path is
 * reachable in a browser rather than only in a test.
 */
export type DemoWorkspace = {
  id: string;
  accountId: string;
  name: string;
  docRoomId: string;
  archivedAt?: Date;
};

export const DEMO_WORKSPACE: DemoWorkspace = {
  id: "ws_demo",
  accountId: "acct_demo",
  name: "Demo workspace",
  docRoomId: "doc_demo",
};

export const DEMO_ARCHIVED_WORKSPACE: DemoWorkspace = {
  id: "ws_demo_archived",
  accountId: "acct_demo",
  name: "Archived planning notes",
  docRoomId: "doc_demo_archived",
  archivedAt: new Date("2026-11-01T09:00:00.000Z"),
};

export const DEMO_WORKSPACES: DemoWorkspace[] = [DEMO_WORKSPACE, DEMO_ARCHIVED_WORKSPACE];
