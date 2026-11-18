import { z } from "zod";

import { defineCapability } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { authorizeWorkspace } from "../access";
import { presentUpdateWorkspace } from "../presentation";
import { updateWorkspaceWith } from "../service";
import { WORKSPACE_STATUSES } from "../status";

import { linked, NOT_FOUND, resultSchema, workspaceSummary } from "./internals";

export const updateWorkspace = defineCapability({
  name: "updateWorkspace",
  description:
    "Rename a workspace, change its description or move it to another stage. Send only the fields that change; the others keep their current value. An empty description clears it. Requires the workspace id from `listWorkspaces`. This cannot archive or delete a workspace.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(WORKSPACE_STATUSES).optional(),
  }),
  output: resultSchema({ workspace: workspaceSummary }),
  callers: ["human", "agent"] as const,
  invalidates: (output) => [routes.dashboard, routes.workspaces, output.workspace.link],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, input, access, { signal }) => {
    const result = await updateWorkspaceWith(
      access,
      {
        id: access.workspace.id,
        name: input.name,
        description: input.description,
        status: input.status,
      },
      { signal },
    );

    return linked(result, "Send only the fields that should change.");
  },
  present: presentUpdateWorkspace,
});
