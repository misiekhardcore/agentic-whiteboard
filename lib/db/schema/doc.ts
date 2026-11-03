import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { createId } from "@paralleldrive/cuid2";
import { bytea } from "../bytea";
import { relations } from "drizzle-orm";

export const docs = pgTable("doc", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  workspaceId: text("workspaceId")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),

  content: jsonb("content"),
  yjsState: bytea("yjsState"),

  createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const docsRelations = relations(docs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [docs.workspaceId],
    references: [workspaces.id],
  }),
}));
