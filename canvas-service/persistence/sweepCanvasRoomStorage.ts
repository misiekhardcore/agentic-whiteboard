import { readdirSync } from "node:fs";

import { forgetCanvasRoomStorage } from "./forgetCanvasRoomStorage";

/**
 * Drops the working stores of canvases the app no longer serves. A delete whose
 * forget call never arrived would otherwise leave its file behind for good.
 *
 * The app decides liveness, so an unreadable directory or an app that cannot
 * answer leaves every file in place: a missed sweep costs disk, while deleting
 * a live canvas's edits costs the drawing.
 */
export async function sweepCanvasRoomStorage({
  directory,
  isLive,
  log = () => undefined,
}: {
  directory: string;
  isLive: (workspaceId: string) => Promise<boolean>;
  log?: (message: string) => void;
}): Promise<number> {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return 0;
  }

  let removed = 0;

  for (const entry of entries) {
    if (!entry.endsWith(".db")) continue;
    const workspaceId = entry.slice(0, -".db".length);

    try {
      if (await isLive(workspaceId)) continue;

      forgetCanvasRoomStorage({ directory, workspaceId });
      removed += 1;
      log(`swept the room of ${workspaceId}`);
    } catch (error) {
      log(
        `could not decide the room of ${workspaceId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  return removed;
}
