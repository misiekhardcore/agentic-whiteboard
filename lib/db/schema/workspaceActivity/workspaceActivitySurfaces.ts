import { pgEnum } from "drizzle-orm/pg-core";

import { WORKSPACE_ACTIVITY_SURFACES } from "../../../workspace/activity";

export const workspaceActivitySurfaceEnum = pgEnum(
  "WorkspaceActivitySurface",
  WORKSPACE_ACTIVITY_SURFACES,
);
