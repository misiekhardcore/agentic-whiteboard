import { z } from "zod";

import { forgetCanvasRoom } from "@/lib/canvas/service";
import { defineCapability } from "@/lib/capabilities/define";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";

import { authorizeWorkspace } from "../access";
import { workspaceIdSchema } from "../rules";
import { deleteWorkspaceWith } from "../service";

import { linked, NOT_FOUND, summaryOutput } from "./internals";

export const deleteWorkspace = defineCapability({
  name: "deleteWorkspace",
  description:
    "Delete an archived workspace permanently, with its documents, canvas and agent history. Only an archived workspace can be deleted. This needs the person's approval: the call pauses and they confirm before anything changes.",
  input: z.object({
    workspaceId: workspaceIdSchema,
  }),
  output: summaryOutput,
  callers: ["human", "agent"] as const,
  approval: "always" as const,
  changes: (output) => [
    { key: CHANGE_KEYS.workspaces, scope: "account" },
    { key: workspaceChangeKey(output.workspace.id), scope: "account" },
  ],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, _input, access, { signal }) => {
    const result = await deleteWorkspaceWith(access, { signal });

    // The row is gone, so the room's SQLite store has nothing left to reopen.
    // A missed call is the service's startup sweep's problem, not the delete's.
    if (result.ok) await forgetCanvasRoom({ workspaceId: access.workspace.id });

    return linked(result, "Archive the workspace first, then delete it permanently.");
  },
});
