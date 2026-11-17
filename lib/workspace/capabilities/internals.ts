import { z } from "zod";

import {
  type CapabilityFailure,
  capabilityFailureSchema,
  type CapabilityOutput,
  success,
} from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import type { WorkspaceMutationResult } from "../contracts";
import { WORKSPACE_STATUSES } from "../status";

export /**
 * The workspace catalog, defined once for the agent's tools and the server
 * actions the dashboard calls.
 *
 * Authorization is not re-implemented here: `authorize` calls the context's own
 * access check and hands the loaded row to the handler, so a refused id is
 * reported as missing and the write never re-reads the row.
 */
const NOT_FOUND = "That workspace could not be found. Call listWorkspaces to get a current id.";

export const workspaceSummary = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(WORKSPACE_STATUSES),
  link: z.string(),
});

export const workspaceDetail = workspaceSummary.extend({
  description: z.string().nullable(),
  archived: z.boolean(),
});

export /** The success half of a result; the failure half is always the shared shape. */
function resultSchema<T extends z.ZodRawShape>(shape: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), ...shape }),
    capabilityFailureSchema,
  ]);
}

export const summaryOutput = resultSchema({ workspace: workspaceSummary });

export type SummaryPayload = { workspace: z.infer<typeof workspaceSummary> };

export /**
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
