import { relations } from "drizzle-orm";

import { workspaces } from "../workspace";

import { workspaceActivities } from "./workspaceActivities";

export const workspaceActivitiesRelations = relations(workspaceActivities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceActivities.workspaceId],
    references: [workspaces.id],
  }),
}));
