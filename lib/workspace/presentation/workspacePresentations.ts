import { type ToolPresentation } from "@/lib/capabilities/presentation";

import { presentArchiveWorkspace } from "./presentArchiveWorkspace";
import { presentCreateWorkspace } from "./presentCreateWorkspace";
import { presentDeleteWorkspace } from "./presentDeleteWorkspace";
import { presentGetWorkspace } from "./presentGetWorkspace";
import { presentListWorkspaces } from "./presentListWorkspaces";
import { presentOpenWorkspace } from "./presentOpenWorkspace";
import { presentRestoreWorkspace } from "./presentRestoreWorkspace";
import { presentUpdateWorkspace } from "./presentUpdateWorkspace";

/** Keyed by capability name, which is also the tool name. */
export const workspacePresentations: Record<string, (input: unknown) => ToolPresentation> = {
  createWorkspace: presentCreateWorkspace,
  listWorkspaces: presentListWorkspaces,
  getWorkspace: presentGetWorkspace,
  updateWorkspace: presentUpdateWorkspace,
  restoreWorkspace: presentRestoreWorkspace,
  archiveWorkspace: presentArchiveWorkspace,
  deleteWorkspace: presentDeleteWorkspace,
  openWorkspace: presentOpenWorkspace,
};
