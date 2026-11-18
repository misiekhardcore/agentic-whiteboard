import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";

import { createOrganization as createOrganizationFor } from "../invitations";

import { MENU, outcome } from "./internals";

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
