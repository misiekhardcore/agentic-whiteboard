import { z } from "zod";

import { WORKSPACE_ID_INVALID_MESSAGE } from "./constants";

/** Ids are cuid2, what the app mints, or a UUID, what older rows still carry. */
const WORKSPACE_ID_PATTERN =
  /^(?:[a-z0-9]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Every capability's `workspaceId`, so a description such as "everything" is
 * refused with a message the caller can act on instead of becoming a lookup
 * that reads as a missing row.
 */
export const workspaceIdSchema = z
  .string()
  .min(1, "Choose a workspace.")
  .regex(WORKSPACE_ID_PATTERN, WORKSPACE_ID_INVALID_MESSAGE);
