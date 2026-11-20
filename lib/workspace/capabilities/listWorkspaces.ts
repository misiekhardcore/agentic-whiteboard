import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { listWorkspacesFor } from "../queries";

import { resultSchema, workspaceDetail } from "./internals";

export const listWorkspaces = defineCapability({
  name: "listWorkspaces",
  description:
    "List the workspaces in the person's active account, newest first, with each workspace's id, name, description, stage, `archived` flag and `link`. Call it to find an id before reading or changing a workspace; never guess one. Pass `includeArchived: true` when the request is about archived workspaces.",
  input: z.object({ includeArchived: z.boolean().optional() }),
  output: resultSchema({ workspaces: z.array(workspaceDetail) }),
  callers: ["human", "agent"] as const,
  handler: async (ctx, input) => {
    const workspaces = await listWorkspacesFor(ctx.actor, {
      includeArchived: input.includeArchived === true,
    });

    return success({
      workspaces: workspaces.map((workspace) => ({
        ...workspace,
        link: routes.workspace(workspace.id),
      })),
    });
  },
});
