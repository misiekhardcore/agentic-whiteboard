import { z } from "zod";

import { defineCapability } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { authorizeWorkspace } from "../access";
import { presentRestoreWorkspace } from "../presentation";
import { restoreWorkspaceWith } from "../service";

import { linked, NOT_FOUND, summaryOutput } from "./internals";

export const restoreWorkspace = defineCapability({
  name: "restoreWorkspace",
  description:
    "Bring an archived workspace back to the dashboard and into the plan meter. Requires the id of an archived workspace from `listWorkspaces` with `includeArchived: true`. Returns the restored workspace with its `link`.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
  }),
  output: summaryOutput,
  callers: ["human", "agent"] as const,
  invalidates: (output) => [
    routes.dashboard,
    routes.dashboardArchive,
    routes.workspaces,
    output.workspace.link,
  ],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, _input, access, { signal }) => {
    const result = await restoreWorkspaceWith(access, { signal });
    return linked(result);
  },
  present: presentRestoreWorkspace,
});
