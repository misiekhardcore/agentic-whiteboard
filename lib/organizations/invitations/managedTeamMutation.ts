import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { organizationErrorMessage } from "../errors";

import { isManager } from "./internals";

/**
 * One thing an owner or admin does to the team, and how it reads when it cannot
 * happen: the refusal for a caller who may not manage this organization, the
 * operator's line, and the sentence for an adapter error we cannot name.
 */
export type ManagedTeamMutation = {
  refusal: string;
  fallback: string;
  log: string;
  /** What must be true of the row being changed, once the caller is allowed. */
  prepare?: () => Promise<CapabilityFailure | null>;
  run: () => Promise<unknown>;
};

/**
 * Runs a team mutation the way every one of them has to: gate on the caller's
 * role in *this* organization, hand the write to the adapter, and turn its
 * refusal into a sentence while leaving the details in the log. Nothing throws
 * here — a failed mutation is a refusal the form can show.
 *
 * The gate is asked before the row is even looked up, so a caller who may not
 * manage this organization never learns whether a target exists, and the caller
 * never assembles the try/catch itself.
 */
export async function managedTeamMutation(
  { userId, organizationId }: { userId: string; organizationId: string },
  mutation: ManagedTeamMutation,
): Promise<CapabilityFailure | null> {
  if (!(await isManager(userId, organizationId))) return failure(mutation.refusal);

  if (mutation.prepare) {
    const refused = await mutation.prepare();
    if (refused) return refused;
  }

  try {
    await mutation.run();
  } catch (error) {
    console.error(mutation.log, error);
    return failure(organizationErrorMessage(error, mutation.fallback));
  }

  return null;
}
