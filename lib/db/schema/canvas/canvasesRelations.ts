import { relations } from "drizzle-orm";

import { workspaces } from "../workspace";

import { canvases } from "./canvases";

export const canvasesRelations = relations(canvases, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [canvases.workspaceId],
    references: [workspaces.id],
  }),
}));
