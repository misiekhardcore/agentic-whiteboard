import { type CapabilityFailure, failure } from "@/lib/capabilities/define";

import { WORKSPACE_ABORTED_MESSAGE } from "./constants";

/**
 * A stopped request must not leave a change behind. Checked before any work and
 * again just before the write, which is the last await before it.
 */
export function abortRefusal(signal?: AbortSignal): CapabilityFailure | null {
  return signal?.aborted ? failure(WORKSPACE_ABORTED_MESSAGE) : null;
}
