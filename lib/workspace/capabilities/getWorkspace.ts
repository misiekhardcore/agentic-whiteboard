import { z } from "zod";

import { defineCapability, failure, success } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { authorizeWorkspace } from "../access";
import { readWorkspaceWith } from "../queries";
import { workspaceIdSchema } from "../rules";

import { NOT_FOUND, resultSchema, workspaceDetail } from "./internals";

export const getWorkspace = defineCapability({
  name: "getWorkspace",
  description:
    "Read one workspace: its name, description, stage, whether it is archived and its `link`. Requires the workspace id from `listWorkspaces`.",
  input: z.object({
    workspaceId: workspaceIdSchema,
  }),
  output: resultSchema({ workspace: workspaceDetail }),
  callers: ["human", "agent"] as const,
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "view"),
  handler: (_ctx, _input, access) => {
    const result = readWorkspaceWith(access);
    if (!result.ok) return failure(result.error, { hint: NOT_FOUND });

    const { workspace } = result;
    return success({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        status: workspace.status,
        archived: workspace.archivedAt !== null,
        link: routes.workspace(workspace.id),
      },
    });
  },
});
