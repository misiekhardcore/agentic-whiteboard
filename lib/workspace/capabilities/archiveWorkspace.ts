import { z } from "zod";

import { defineCapability } from "@/lib/capabilities/define";
import { CHANGE_KEYS, workspaceChangeKey } from "@/lib/shared/changes";

import { authorizeWorkspace } from "../access";
import { presentArchiveWorkspace } from "../presentation";
import { archiveWorkspaceWith } from "../service";

import { linked, NOT_FOUND, summaryOutput } from "./internals";

export const archiveWorkspace = defineCapability({
  name: "archiveWorkspace",
  description:
    "Hide a workspace from the dashboard and stop it counting against the plan, keeping its stage and content for a restore. This needs the person's approval: the call pauses and they confirm before anything changes. Requires the workspace id from `listWorkspaces`.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
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
    const result = await archiveWorkspaceWith(access, { signal });
    return linked(result, NOT_FOUND);
  },
  present: presentArchiveWorkspace,
});
