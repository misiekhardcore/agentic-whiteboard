import { pgEnum } from "drizzle-orm/pg-core";

import { WORKSPACE_STATUSES } from "../../../workspace/status";

export const workspaceStatusEnum = pgEnum("WorkspaceStatus", WORKSPACE_STATUSES);
