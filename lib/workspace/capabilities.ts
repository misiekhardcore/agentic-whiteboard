import { z } from "zod";

import {
  type CapabilityFailure,
  capabilityFailureSchema,
  type CapabilityOutput,
  defineCapability,
  defineClientCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import { authorizeWorkspace } from "./access";
import type { WorkspaceMutationResult } from "./contracts";
import {
  presentArchiveWorkspace,
  presentCreateWorkspace,
  presentDeleteWorkspace,
  presentGetWorkspace,
  presentListWorkspaces,
  presentOpenWorkspace,
  presentRestoreWorkspace,
  presentUpdateWorkspace,
} from "./presentation";
import { listWorkspacesFor, readWorkspaceWith } from "./queries";
import {
  archiveWorkspaceWith,
  createWorkspaceFor,
  deleteWorkspaceWith,
  restoreWorkspaceWith,
  updateWorkspaceWith,
} from "./service";
import { WORKSPACE_STATUSES } from "./status";

/**
 * The workspace catalog, defined once for the agent's tools and the server
 * actions the dashboard calls.
 *
 * Authorization is not re-implemented here: `authorize` calls the context's own
 * access check and hands the loaded row to the handler, so a refused id is
 * reported as missing and the write never re-reads the row.
 */

const NOT_FOUND = "That workspace could not be found. Call listWorkspaces to get a current id.";

const workspaceSummary = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(WORKSPACE_STATUSES),
  link: z.string(),
});

const workspaceDetail = workspaceSummary.extend({
  description: z.string().nullable(),
  archived: z.boolean(),
});

/** The success half of a result; the failure half is always the shared shape. */
function resultSchema<T extends z.ZodRawShape>(shape: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), ...shape }),
    capabilityFailureSchema,
  ]);
}

const summaryOutput = resultSchema({ workspace: workspaceSummary });

type SummaryPayload = { workspace: z.infer<typeof workspaceSummary> };

/**
 * The service's result in the capability contract: a refusal passes through as
 * the kernel's failure shape, and a success gains the in-app link.
 */
function linked(result: WorkspaceMutationResult, hint?: string): CapabilityOutput<SummaryPayload> {
  if (!result.ok) {
    const refusal: CapabilityFailure = hint ? { ...result, hint } : result;
    return refusal;
  }

  return success({
    workspace: {
      ...result.workspace,
      link: routes.workspace(result.workspace.id),
    },
  });
}

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
  invalidates: () => [routes.dashboard, routes.workspaces],
  handler: async (ctx, input, _resource, { signal }) => {
    const result = await createWorkspaceFor(
      ctx.actor,
      { name: input.name, description: input.description ?? "" },
      { signal },
    );

    return linked(result, "Fix the field it names, or check the plan's workspace limit.");
  },
  present: presentCreateWorkspace,
});

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
  present: presentListWorkspaces,
});

export const getWorkspace = defineCapability({
  name: "getWorkspace",
  description:
    "Read one workspace: its name, description, stage, whether it is archived and its `link`. Requires the workspace id from `listWorkspaces`.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
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
  present: presentGetWorkspace,
});

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

export const restoreWorkspace = defineCapability({
  name: "restoreWorkspace",
  description:
    "Bring an archived workspace back to the dashboard and into the plan meter. Requires the id of an archived workspace from `listWorkspaces` with `includeArchived: true`. Returns the restored workspace with its `link`.",
  input: z.object({
    workspaceId: z.string().min(1, "Choose a workspace."),
  }),
  output: summaryOutput,
  callers: ["human", "agent"] as const,
  invalidates: (output) => [routes.dashboard, routes.workspaces, output.workspace.link],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, _input, access, { signal }) => {
    const result = await restoreWorkspaceWith(access, { signal });
    return linked(result);
  },
  present: presentRestoreWorkspace,
});

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
  invalidates: (output) => [routes.dashboard, routes.workspaces, output.workspace.link],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, _input, access, { signal }) => {
    const result = await archiveWorkspaceWith(access, { signal });
    return linked(result, NOT_FOUND);
  },
  present: presentArchiveWorkspace,
});

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
  invalidates: (output) => [routes.dashboard, routes.workspaces, output.workspace.link],
  notFound: NOT_FOUND,
  authorize: async (ctx, input) => authorizeWorkspace(ctx.actor, input.workspaceId, "edit"),
  handler: async (_ctx, _input, access, { signal }) => {
    const result = await deleteWorkspaceWith(access, { signal });
    return linked(result, "Archive the workspace first, then delete it permanently.");
  },
  present: presentDeleteWorkspace,
});

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
