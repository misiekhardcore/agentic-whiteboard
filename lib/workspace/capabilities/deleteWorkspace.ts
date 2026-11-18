import { z } from "zod";

import { defineCapability } from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { authorizeWorkspace } from "../access";
import { presentDeleteWorkspace } from "../presentation";
import { deleteWorkspaceWith } from "../service";

import { linked, NOT_FOUND, summaryOutput } from "./internals";

export const deleteWorkspace = defineCapability({
  name: "deleteWorkspace",
  description:
    "Delete an archived workspace permanently, with its documents, canvas and agent history. Only an archived workspace can be deleted. This needs the person's approval: the call pauses and they confirm before anything changes.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
  }),
  output: summaryOutput,
  callers: ["human", "agent"] as const,
  approval: "always" as const,
  invalidates: (output) => [
    routes.dashboard,
    routes.dashboardArchive,
    routes.workspaces,
    output.workspace.link,
  ],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, _input, access, { signal }) => {
    const result = await deleteWorkspaceWith(access, { signal });
    return linked(result, "Archive the workspace first, then delete it permanently.");
  },
  present: presentDeleteWorkspace,
});
