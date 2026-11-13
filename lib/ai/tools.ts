import { jsonSchema, tool, type ToolSet } from "ai";

import { routes } from "@/lib/routes";
import {
  createWorkspaceFor,
  type WorkspaceActor,
} from "@/lib/workspace-service";

/**
 * Tools are built per run and close over the authenticated actor, so the model
 * chooses among permitted operations but never supplies the account or user id.
 * Every tool delegates to the same catalog the human UI calls.
 */

export type WorkspaceToolActor = WorkspaceActor;

export const CREATE_WORKSPACE_TOOL = "createWorkspace" as const;

type CreateWorkspaceInput = {
  name: string;
  description?: string;
};

export type CreateWorkspaceOutput =
  | {
      created: true;
      workspaceId: string;
      name: string;
      /** The in-app path to the new workspace, ready to link to. */
      link: string;
    }
  | { created: false; error: string };

/**
 * The create-workspace tool for one run. Exported on its own so a test can call
 * `execute` with the input type it declares, while `createWorkspaceTools` only
 * groups the catalog the agent is offered.
 */
export function createWorkspaceTool(actor: WorkspaceToolActor) {
  return tool({
    description:
      "Create a workspace in the person's active account. Use it when they ask you to set up or start a workspace; do not ask for ids. Returns the new workspace's id, name and `link` (its path in the app), or an explanation of why it could not be created. Mention the workspace with `[name](link)` so the person can open it.",
    inputSchema: jsonSchema<CreateWorkspaceInput>({
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A short, human-readable name for the workspace.",
        },
        description: {
          type: "string",
          description: "Optional one-sentence summary of what it is for.",
        },
      },
      required: ["name"],
      additionalProperties: false,
    }),
    execute: async (input, { abortSignal }): Promise<CreateWorkspaceOutput> => {
      const result = await createWorkspaceFor(
        actor,
        {
          name: typeof input?.name === "string" ? input.name : "",
          description:
            typeof input?.description === "string" ? input.description : "",
        },
        // The SDK passes the run's abort signal (merged with any tool timeout);
        // forward it so a Stop cancels the write too.
        { signal: abortSignal },
      );

      if (!result.ok) {
        return {
          created: false,
          error:
            result.fieldErrors?.name ??
            result.fieldErrors?.description ??
            result.error,
        };
      }

      return {
        created: true,
        workspaceId: result.workspace.id,
        name: result.workspace.name,
        link: routes.workspace(result.workspace.id),
      };
    },
  });
}

/** The catalog of tools offered to the agent for one run. */
export function createWorkspaceTools(actor: WorkspaceToolActor): ToolSet {
  return { [CREATE_WORKSPACE_TOOL]: createWorkspaceTool(actor) };
}
