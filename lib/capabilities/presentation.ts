/**
 * How a capability reads in the conversation: the action, and what it acted on.
 *
 * Deliberately free of server imports — the thread is a client component, and
 * it must not pull the database in just to label a tool call. The capability
 * definitions use these same functions, so a capability cannot be labelled one
 * way for the model and another for the person.
 */

export type ToolPresentation = {
  /** The action, e.g. "Archive workspace". */
  title: string;
  /** What it acted on, e.g. the workspace name. */
  subject?: string | null;
};

function field(input: unknown, key: string): unknown {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)[key]
    : undefined;
}

function quoted(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? `“${value.trim()}”` : null;
}

export const presentCreateWorkspace = (input: unknown): ToolPresentation => ({
  title: "Create workspace",
  subject: quoted(field(input, "name")),
});

export const presentListWorkspaces = (): ToolPresentation => ({
  title: "List workspaces",
});

export const presentGetWorkspace = (): ToolPresentation => ({
  title: "Read workspace",
});

export const presentUpdateWorkspace = (input: unknown): ToolPresentation => ({
  title: "Update workspace",
  subject: quoted(field(input, "name")),
});

export const presentRestoreWorkspace = (): ToolPresentation => ({
  title: "Restore workspace",
});

export const presentArchiveWorkspace = (): ToolPresentation => ({
  title: "Archive workspace",
});

export const presentDeleteWorkspace = (): ToolPresentation => ({
  title: "Delete workspace permanently",
});

export const presentOpenWorkspace = (input: unknown): ToolPresentation => ({
  title: "Open workspace",
  subject: quoted(field(input, "name")),
});

/** Keyed by capability name, which is also the tool name. */
export const toolPresentations: Record<string, (input: unknown) => ToolPresentation> = {
  createWorkspace: presentCreateWorkspace,
  listWorkspaces: presentListWorkspaces,
  getWorkspace: presentGetWorkspace,
  updateWorkspace: presentUpdateWorkspace,
  restoreWorkspace: presentRestoreWorkspace,
  archiveWorkspace: presentArchiveWorkspace,
  deleteWorkspace: presentDeleteWorkspace,
  openWorkspace: presentOpenWorkspace,
};

/** Tools the browser performs; they never have a server result to wait for. */
export const CLIENT_TOOL_NAMES: readonly string[] = ["openWorkspace"];
