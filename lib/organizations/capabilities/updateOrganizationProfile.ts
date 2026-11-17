import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";

import { updateOrganizationProfile as updateOrganizationProfileFor } from "../settings";

import { MENU, outcome } from "./internals";

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
