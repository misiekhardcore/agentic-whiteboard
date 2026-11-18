import { z } from "zod";

/**
 * Only a same-origin path is accepted, so a request cannot smuggle a sentence
 * (or a newline) into the instructions through this field.
 */
export const uiContextSchema = z.object({
  pathname: z
    .string()
    .min(1)
    .max(200)
    .regex(/^\/[A-Za-z0-9/_-]*$/, "Only an in-app path is a view."),
  workspaceId: z.string().max(64).optional(),
});
