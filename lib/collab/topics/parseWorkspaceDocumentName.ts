import { WORKSPACE_SURFACES, type WorkspaceSurface } from "../contracts";

import { WORKSPACE_DOCUMENT_PATTERN } from "./internals";

/**
 * Parses a Hocuspocus document name before auth/persistence touches a room.
 * Returns null for anything this app did not name.
 */
export function parseWorkspaceDocumentName(
  documentName: string,
): { workspaceId: string; surface: WorkspaceSurface } | null {
  const match = WORKSPACE_DOCUMENT_PATTERN.exec(documentName);
  if (!match) return null;

  const surface = match[2] as WorkspaceSurface;
  if (!WORKSPACE_SURFACES.includes(surface)) return null;

  return { workspaceId: match[1], surface };
}
