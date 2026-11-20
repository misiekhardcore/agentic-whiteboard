import { field, quoted, type ToolCatalogue } from "@/lib/capabilities/presentation";

/**
 * How the workspace tools read in the conversation: the action, and what it
 * acted on.
 *
 * Deliberately free of server imports — the thread is a client component, and
 * it must not pull the database in just to label a tool call. One entry per
 * capability name, written once: the capability no longer carries a second copy
 * of its label.
 */
export const workspaceToolPresentations: ToolCatalogue = {
  createWorkspace: {
    present: (input) => ({ title: "Create workspace", subject: quoted(field(input, "name")) }),
  },
  listWorkspaces: {
    present: () => ({ title: "List workspaces" }),
  },
  getWorkspace: {
    present: () => ({ title: "Read workspace" }),
  },
  updateWorkspace: {
    present: (input) => ({ title: "Update workspace", subject: quoted(field(input, "name")) }),
  },
  restoreWorkspace: {
    present: () => ({ title: "Restore workspace" }),
  },
  archiveWorkspace: {
    present: () => ({ title: "Archive workspace" }),
  },
  deleteWorkspace: {
    present: () => ({ title: "Delete workspace permanently" }),
  },
  openWorkspace: {
    present: (input) => ({ title: "Open workspace", subject: quoted(field(input, "name")) }),
    client: true,
  },
};
