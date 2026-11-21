import type { WorkspaceSurface } from "@/lib/collab/contracts";
import { db } from "@/lib/db";

import type { WorkspaceActivitySurface, WorkspaceRequester } from "../activity";
import { workspaceActivityFor } from "../rules";

import { recordActivityWith } from "./recordActivityWith";

const ACTIVITY_SURFACE: Record<WorkspaceSurface, WorkspaceActivitySurface> = {
  doc: "DOC",
  canvas: "CANVAS",
};

/**
 * The one entry point a content surface calls when it saves, so the rule for
 * what a save records lives with the history it writes. Nothing produces one
 * yet: the editor and its save path are deferred, and the kinds are named now
 * so the history does not grow a second shape for them later.
 */
export async function recordSurfaceActivity(
  { workspaceId, surface }: { workspaceId: string; surface: WorkspaceSurface },
  requester: WorkspaceRequester,
): Promise<void> {
  await recordActivityWith(
    db,
    workspaceActivityFor(
      workspaceId,
      [
        {
          surface: ACTIVITY_SURFACE[surface],
          kind: surface === "doc" ? "DOC_SAVED" : "CANVAS_SAVED",
          details: {},
        },
      ],
      requester,
    ),
  );
}
