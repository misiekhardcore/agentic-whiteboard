import { pgEnum } from "drizzle-orm/pg-core";

import { WORKSPACE_ACTIVITY_ACTOR_TYPES } from "../../../workspace/activity";

export const workspaceActivityActorTypeEnum = pgEnum(
  "WorkspaceActivityActorType",
  WORKSPACE_ACTIVITY_ACTOR_TYPES,
);
