import { z } from "zod";

import { revokeCanvasSessions } from "@/lib/canvas/service";
import { defineCapability } from "@/lib/capabilities/define";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";

import { authorizeWorkspace } from "../access";
import { workspaceIdSchema, workspaceRequesterFor } from "../rules";
import { restoreWorkspaceWith } from "../service";

import { linked, NOT_FOUND, summaryOutput } from "./internals";

export const restoreWorkspace = defineCapability({
  name: "restoreWorkspace",
  description:
    "Bring an archived workspace back to the dashboard and into the plan meter. Requires the id of an archived workspace from `listWorkspaces` with `includeArchived: true`. Returns the restored workspace with its `link`.",
  input: z.object({
    workspaceId: workspaceIdSchema,
  }),
  output: summaryOutput,
  callers: ["human", "agent"] as const,
  changes: (output) => [
    { key: CHANGE_KEYS.workspaces, scope: "account" },
    { key: workspaceChangeKey(output.workspace.id), scope: "account" },
  ],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (ctx, _input, access, { signal }) => {
    const result = await restoreWorkspaceWith(access, workspaceRequesterFor(ctx), { signal });

    // The reverse of archiving: a board still open from before the restore
    // holds a read-only session and would stay one until the page is reloaded.
    if (result.ok) await revokeCanvasSessions({ workspaceId: access.workspace.id });

    return linked(result);
  },
});
