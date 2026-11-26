import { z } from "zod";

import { can, workspaceReadOnly } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { success } from "../result";

/**
 * One connection attempt to a workspace's document room. Authorization and the
 * read-only answer are decided here, once, and the app signs them into the
 * token; the room owner verifies the claims and enforces read-only itself. The
 * browser never gets to choose either.
 */
export const docConnection = defineCapability<
  { workspaceId: string },
  { documentName: string; readOnly: boolean },
  WorkspaceRecord
>({
  name: "doc.connection",
  description: "Authorize one connection attempt to a workspace's document room.",
  effect: "read",
  callers: ["human"],
  input: z.object({ workspaceId: z.string().min(1) }),
  output: z.object({ documentName: z.string(), readOnly: z.boolean() }),
  authorize: async (context, input) => {
    const workspace = await context.workspaces.findById(input.workspaceId);
    if (workspace === null) return null;
    return can(context.actor, "workspace.read", workspace) ? workspace : null;
  },
  run: (_context, _input, workspace) =>
    success({
      documentName: workspace.docRoomId,
      readOnly: workspaceReadOnly(workspace),
    }),
});
