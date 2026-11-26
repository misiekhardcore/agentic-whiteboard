import { z } from "zod";

import { can } from "../can";
import type { WorkspaceRecord } from "../context";
import { defineCapability } from "../define";
import { success } from "../result";

const documentContent = z.object({ title: z.string() });

/**
 * The thin line through the whole architecture: the row is authorized for this
 * actor, and the title and revision come from the room owner behind the port —
 * not from a constant and not from a second copy of the content.
 */
export const readWorkspace = defineCapability<
  { workspaceId: string },
  { title: string; revision: string },
  WorkspaceRecord
>({
  name: "workspace.read",
  description: "Read a workspace's document title and revision through its room owner.",
  effect: "read",
  callers: ["human", "agent"],
  input: z.object({ workspaceId: z.string().min(1) }),
  output: z.object({ title: z.string(), revision: z.string() }),
  authorize: async (context, input) => {
    const workspace = await context.workspaces.findById(input.workspaceId);
    if (workspace === null) return null;
    return can(context.actor, "workspace.read", workspace) ? workspace : null;
  },
  run: async (context, _input, workspace) => {
    const snapshot = await context.rooms.snapshot({
      kind: "doc",
      id: workspace.docRoomId,
      accountId: workspace.accountId,
    });
    const content = documentContent.parse(snapshot.content);
    return success({ title: content.title, revision: snapshot.revision });
  },
});
