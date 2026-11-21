import { pgEnum } from "drizzle-orm/pg-core";

import { WORKSPACE_ACTIVITY_KINDS } from "../../../workspace/activity";

export const workspaceActivityKindEnum = pgEnum("WorkspaceActivityKind", WORKSPACE_ACTIVITY_KINDS);
