import { relations } from "drizzle-orm";

import { workspaces } from "../workspace";

import { docs } from "./docs";

export const docsRelations = relations(docs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [docs.workspaceId],
    references: [workspaces.id],
  }),
}));
