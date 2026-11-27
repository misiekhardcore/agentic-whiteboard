import { z } from "zod";

import { can, workspaceReadOnly } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { success } from "../result";

/**
 * The workspace header: its name, the document's current revision and whether
 * the lifecycle makes that document read-only. The name is metadata; the
 * revision comes from the room owner behind the port, never from a second copy
 * of the content.
 *
 * An unreachable room owner renders as `revision: null`, not as a failed page.
 * The ticket requires the rest of the workspace to keep working when the
 * document service is down; the editor island reports the surface itself.
 */
export const readWorkspace = defineCapability<
  { workspaceId: string },
  { title: string; revision: string | null; readOnly: boolean },
  WorkspaceRecord
>({
  name: "workspace.read",
  description: "Read a workspace's name, document revision and read-only state.",
  effect: "read",
  callers: ["human", "agent"],
  input: z.object({ workspaceId: z.string().min(1) }),
  output: z.object({
    title: z.string(),
    revision: z.string().nullable(),
    readOnly: z.boolean(),
  }),
  authorize: async (context, input) => {
    const workspace = await context.workspaces.findById(input.workspaceId);
    if (workspace === null) return null;
    return can(context.actor, "workspace.read", workspace) ? workspace : null;
  },
  run: async (context, _input, workspace) => {
    let revision: string | null = null;

    try {
      const snapshot = await context.rooms.snapshot({
        kind: "doc",
        id: workspace.docRoomId,
        accountId: workspace.accountId,
      });
      revision = snapshot.revision;
    } catch {
      // The workspace metadata was authorized and read; only the content
      // surface is unavailable, and the page says so next to the empty revision.
    }

    return success({
      title: workspace.name,
      revision,
      readOnly: workspaceReadOnly(workspace),
    });
  },
});
