import { type WorkspaceFieldErrors } from "../forms";

export function hasFieldErrors(fieldErrors: WorkspaceFieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}
