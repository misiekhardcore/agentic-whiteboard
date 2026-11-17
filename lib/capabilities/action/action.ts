import { revalidatePath } from "next/cache";

import { type Capability, type CapabilityOutput } from "../define";

import type { ActionOptions } from "./internals";
import { targetOf } from "./internals";
import { runCapability } from "./runCapability";

/**
 * The human entry point for one capability: authenticate, invoke, and
 * revalidate the paths the capability declared. Exported from a `"use server"`
 * file, this becomes the endpoint; the capability module itself stays a plain
 * server module, so no handler can be called over HTTP without a session.
 */
export function action<I, T, R>(
  capability: Capability<I, T, R>,
  { revalidate = revalidatePath }: ActionOptions = {},
) {
  return async (raw: unknown): Promise<CapabilityOutput<T>> => {
    const output = await runCapability(capability, raw);

    if (output.ok && capability.invalidates) {
      for (const target of capability.invalidates(output)) {
        const { path, layout } = targetOf(target);
        // A shell change (profile, role, plan) must refresh the layout, not one
        // page: the header and the sidebar read the account too.
        revalidate(path, layout ? "layout" : "page");
      }
    }

    return output;
  };
}
