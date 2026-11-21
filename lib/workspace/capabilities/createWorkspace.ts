import { z } from "zod";

import { defineCapability } from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { workspaceRequesterFor } from "../rules";
import { createWorkspaceFor } from "../service";

import { linked, resultSchema, workspaceSummary } from "./internals";

export const createWorkspace = defineCapability({
  name: "createWorkspace",
  description:
    "Create a workspace in the person's active account. Use it when they ask you to set up or start a workspace; do not ask for ids. Returns the new workspace with its `link`, or why it could not be created. Mention it as `[name](link)` so the person can open it.",
  input: z.object({
    name: z.string({ error: "Name your workspace." }),
    description: z.string().optional(),
  }),
  output: resultSchema({ workspace: workspaceSummary }),
  callers: ["human", "agent"] as const,
  changes: () => [{ key: CHANGE_KEYS.workspaces, scope: "account" }],
  handler: async (ctx, input, _resource, { signal }) => {
    const result = await createWorkspaceFor(
      workspaceRequesterFor(ctx),
      { name: input.name, description: input.description ?? "" },
      { signal },
    );

    return linked(result, "Fix the field it names, or check the plan's workspace limit.");
  },
});
