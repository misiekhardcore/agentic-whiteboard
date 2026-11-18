import { z } from "zod";

import { defineClientCapability } from "@/lib/capabilities/define";

import { presentOpenWorkspace } from "../presentation";

/**
 * Navigation is the one thing the agent can do to the interface: the browser
 * opens the workspace, so the person lands where the reply points.
 */
export const openWorkspace = defineClientCapability({
  name: "openWorkspace",
  description:
    "Open a workspace in the person's browser, so they land on it instead of having to find it. Use the id and name from `listWorkspaces` or `createWorkspace`. Say that you opened it.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
    name: z.string().optional(),
  }),
  callers: ["agent"] as const,
  client: "openWorkspace",
  present: presentOpenWorkspace,
});
