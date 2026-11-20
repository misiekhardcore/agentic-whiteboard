import { headers } from "next/headers";
import { z } from "zod";

import { defineCapability, success } from "@/lib/capabilities/define";
import { CHANGE_KEYS } from "@/lib/shared/changes";

import { createOrganization as createOrganizationFor } from "../invitations";

import { outcome } from "./internals";

export const createOrganization = defineCapability({
  name: "createOrganization",
  description: "Create an organization the person owns.",
  input: z.object({ name: z.string() }),
  output: outcome,
  callers: ["human"] as const,
  changes: () => [{ key: CHANGE_KEYS.account, scope: "account" }],
  handler: async (_ctx, input) => {
    const refusal = await createOrganizationFor({
      name: input.name,
      headers: await headers(),
    });

    return refusal ?? success({});
  },
});
