import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { workspaces } from "./workspace";

export const canvases = pgTable("canvas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  workspaceId: text("workspaceId")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),

  content: jsonb("content"),

  createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),

  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
});

export const canvasesRelations = relations(canvases, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [canvases.workspaceId],
    references: [workspaces.id],
  }),
}));
