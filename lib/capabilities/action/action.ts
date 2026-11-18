import { refresh } from "next/cache";

import { type Capability, type CapabilityOutput } from "../define";

import { runCapability } from "./runCapability";

/**
 * The human entry point for one capability: authenticate, invoke. Exported from
 * a `"use server"` file, this becomes the endpoint; the capability module itself
 * stays a plain server module, so no handler can be called over HTTP without a
 * session.
 *
 * A successful call publishes the datasets it declared in `changes` for every
 * other open tab, and refreshes this one: the browser that submitted the form
 * re-reads the route it is on, without a path to name or a socket to wait for.
 */
export function action<I, T, R>(capability: Capability<I, T, R>) {
  return async (raw: unknown): Promise<CapabilityOutput<T>> => {
    const output = await runCapability(capability, raw);

    if (output.ok && capability.changes) refresh();

    return output;
  };
}
