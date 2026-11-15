import { headers } from "next/headers";
import { z } from "zod";

import {
  capabilityFailureSchema,
  defineCapability,
  failure,
  success,
} from "@/lib/capabilities/define";
import { routes } from "@/lib/shared/routes";

import {
  acceptInvitation as acceptInvitationFor,
  cancelInvitation as cancelInvitationFor,
  changeMemberRole,
  createOrganization as createOrganizationFor,
  inviteMember as inviteMemberFor,
  removeMember as removeMemberFor,
  switchAccount as switchAccountFor,
} from "./invitations";
import { updateOrganizationProfile as updateOrganizationProfileFor } from "./settings";

/**
 * The organization's operations.
 *
 * They are capabilities like any other — same validation, same refusal shape,
 * same revalidation — but `callers: ["human"]` says the agent may not perform
 * them. That is a policy decision, not a missing adapter: promoting one later is
 * this line, and the handler already enforces the role.
 *
 * Authorization lives in the application functions beside the Better Auth call,
 * because the rule needs the caller's role *in this organization* and there is
 * no row to hand from `authorize` to a handler.
 */

const outcome = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  capabilityFailureSchema,
]);

const MENU = { path: routes.dashboardOrganization, layout: true } as const;

export const createOrganization = defineCapability({
  name: "createOrganization",
  description: "Create an organization the person owns.",
  input: z.object({ name: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [MENU],
  handler: async (_ctx, input) => {
    const refusal = await createOrganizationFor({
      name: input.name,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const switchAccount = defineCapability({
  name: "switchAccount",
  description: "Make one of the person's organizations their active account, or the personal one.",
  input: z.object({ organizationId: z.string().optional() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [MENU],
  handler: async (ctx, input) => {
    const raw = input.organizationId?.trim();
    const refusal = await switchAccountFor({
      userId: ctx.actor.userId,
      organizationId: raw && raw !== "personal" ? raw : null,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const inviteMember = defineCapability({
  name: "inviteMember",
  description: "Invite someone to an organization the person administers.",
  input: z.object({
    organizationId: z.string(),
    email: z.string(),
    role: z.string().optional(),
  }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [routes.dashboardOrganization],
  handler: async (ctx, input) => {
    const refusal = await inviteMemberFor({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      email: input.email,
      role: input.role === "admin" ? "admin" : "member",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const updateMemberRole = defineCapability({
  name: "updateMemberRole",
  description: "Move a member between member and admin.",
  input: z.object({
    organizationId: z.string(),
    memberId: z.string(),
    role: z.string().optional(),
  }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [routes.dashboardOrganization],
  handler: async (ctx, input) => {
    const refusal = await changeMemberRole({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      memberId: input.memberId,
      role: input.role === "admin" ? "admin" : "member",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const cancelInvitation = defineCapability({
  name: "cancelInvitation",
  description: "Cancel a pending invitation so its link stops working.",
  input: z.object({ invitationId: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [routes.dashboardOrganization],
  handler: async (ctx, input) => {
    const refusal = await cancelInvitationFor({
      userId: ctx.actor.userId,
      invitationId: input.invitationId,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const removeMember = defineCapability({
  name: "removeMember",
  description: "Remove someone from an organization the person administers.",
  input: z.object({ organizationId: z.string(), memberId: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [routes.dashboardOrganization],
  handler: async (ctx, input) => {
    const refusal = await removeMemberFor({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      memberId: input.memberId,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const acceptInvitation = defineCapability({
  name: "acceptInvitation",
  description: "Accept an invitation addressed to the person's email address.",
  input: z.object({ invitationId: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [MENU],
  handler: async (_ctx, input) => {
    if (!input.invitationId) return failure("That invitation link is incomplete.");

    const refusal = await acceptInvitationFor({
      invitationId: input.invitationId,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});

export const updateOrganizationProfile = defineCapability({
  name: "updateOrganizationProfile",
  description: "Edit an organization's name, URL or logo.",
  input: z.object({
    organizationId: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().optional(),
  }),
  output: outcome,
  callers: ["human"] as const,
  invalidates: () => [MENU],
  handler: async (ctx, input) => {
    const refusal = await updateOrganizationProfileFor({
      userId: ctx.actor.userId,
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      logo: input.logo ?? "",
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
