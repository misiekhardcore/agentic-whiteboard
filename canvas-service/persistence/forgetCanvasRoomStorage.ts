import { rmSync } from "node:fs";

import { canvasRoomFiles } from "./canvasRoomFiles";

/**
 * Removes a canvas's working store. The row is already gone when this runs, so
 * a room that reopened would have nothing to load from; the file is the only
 * thing left to drop.
 */
export function forgetCanvasRoomStorage({
  directory,
  workspaceId,
}: {
  directory: string;
  workspaceId: string;
}): void {
  for (const file of canvasRoomFiles({ directory, workspaceId })) rmSync(file, { force: true });
}
