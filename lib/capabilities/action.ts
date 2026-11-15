import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSessionAccount } from "@/lib/identity/account";
import { routes, signInPath } from "@/lib/shared/routes";

import {
  type Capability,
  type CapabilityContext,
  type CapabilityOutput,
  type RevalidationTarget,
} from "./define";
import { invoke } from "./invoke";

/**
 * The human entry point for a capability. Authentication comes from the
 * session, never from the request body, so a form field can name a workspace
 * but not an account.
 */

export async function humanContext(): Promise<CapabilityContext> {
  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.dashboard));

  return {
    actorType: "human",
    actor: {
      userId: account.session.user.id,
      organizationId: account.activeOrganizationId,
      accountName: account.activeTeam?.name ?? account.session.user.name,
    },
  };
}

/**
 * A form submission carries its fields as `FormData`; a typed caller passes its
 * object as-is and Zod is the one place that decides what is valid. Action
 * bookkeeping fields (`$ACTION_*`) are not input.
 */
function readInput(raw: unknown): unknown {
  if (typeof FormData === "undefined" || !(raw instanceof FormData)) return raw;

  return Object.fromEntries([...raw.entries()].filter(([key]) => !key.startsWith("$ACTION_")));
}

/** Runs a capability for the signed-in person; nothing is revalidated here. */
export async function runCapability<I, T, R>(
  capability: Capability<I, T, R>,
  raw: unknown,
): Promise<CapabilityOutput<T>> {
  return invoke(capability, await humanContext(), readInput(raw));
}

export type RevalidatePath = (path: string, type?: "page" | "layout") => void;

type ActionOptions = { revalidate?: RevalidatePath };

function targetOf(target: RevalidationTarget): { path: string; layout: boolean } {
  return typeof target === "string"
    ? { path: target, layout: false }
    : { path: target.path, layout: target.layout === true };
}

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
