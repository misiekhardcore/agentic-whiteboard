/** The app has no canvas row for this workspace, so a room has nothing to load. */
export class CanvasSnapshotMissingError extends Error {
  constructor(readonly workspaceId: string) {
    super(`The workspace ${workspaceId} has no canvas.`);
    this.name = "CanvasSnapshotMissingError";
  }
}
