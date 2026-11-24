import { z } from "zod";

import { revokeCanvasSessions } from "@/lib/canvas/service";
import { defineCapability } from "@/lib/capabilities/define";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";

import { authorizeWorkspace } from "../access";
import { workspaceIdSchema, workspaceRequesterFor } from "../rules";
import { archiveWorkspaceWith } from "../service";

import { linked, NOT_FOUND, summaryOutput } from "./internals";

export const archiveWorkspace = defineCapability({
  name: "archiveWorkspace",
  description:
    "Hide a workspace from the dashboard and stop it counting against the plan, keeping its stage and content for a restore. This needs the person's approval: the call pauses and they confirm before anything changes. Requires the workspace id from `listWorkspaces`.",
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
  handler: async (ctx, _input, access, { signal }) => {
    const result = await archiveWorkspaceWith(access, workspaceRequesterFor(ctx), { signal });

    // An already-open board must stop accepting writes now, not at its next
    // connection: closing its sessions makes the client reconnect, and that
    // connection's token is minted read-only.
    if (result.ok) await revokeCanvasSessions({ workspaceId: access.workspace.id });

    return linked(result, NOT_FOUND);
  },
});
