import { z } from "zod";

import { defineCapability } from "@/lib/capabilities/define";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";

import { authorizeWorkspace } from "../access";
import { workspaceIdSchema, workspaceRequesterFor } from "../rules";
import { moveWorkspaceWith } from "../service";
import { WORKSPACE_STATUSES } from "../status";

import { linked, resultSchema, workspaceSummary } from "./internals";

/** A card can vanish between the board's read and the drop; the person needs a refresh, not a tool hint. */
const MOVE_NOT_FOUND = "That workspace could not be found. Refresh the board and try again.";

export const moveWorkspace = defineCapability({
  name: "moveWorkspace",
  description:
    "Move a workspace to a stage and place it where it was dropped. Name the two cards it lands between with their ids: `previousId` is the card above and `nextId` the card below. Omit a neighbour at the end of the column. The server derives the position, and a neighbour that is gone appends instead of refusing. Requires the workspace id from `listWorkspaces`.",
  input: z.object({
    workspaceId: workspaceIdSchema,
    status: z.enum(WORKSPACE_STATUSES),
    previousId: workspaceIdSchema.optional(),
    nextId: workspaceIdSchema.optional(),
  }),
  output: resultSchema({ workspace: workspaceSummary }),
  callers: ["human", "agent"] as const,
  changes: (output) => [
    { key: CHANGE_KEYS.workspaces, scope: "account" },
    { key: workspaceChangeKey(output.workspace.id), scope: "account" },
  ],
  notFound: MOVE_NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (ctx, input, access, { signal }) => {
    const result = await moveWorkspaceWith(
      access,
      workspaceRequesterFor(ctx),
      {
        id: access.workspace.id,
        status: input.status,
        previousId: input.previousId,
        nextId: input.nextId,
      },
      { signal },
    );

    return linked(result, "Check the stage and try the move again.");
  },
});
