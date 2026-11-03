import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { user } from "./auth";
import { relations } from "drizzle-orm";

export const agentPrompts = pgTable(
  "AgentPrompt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    ownerId: text("ownerId").notNull(),

    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    workspaceId: text("workspaceId").references(() => workspaces.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("AgentPrompt_ownerId_createdAt_idx").on(
      table.ownerId,
      table.createdAt,
    ),
  ],
);

export const agentPromptsRelations = relations(
  agentPrompts,
  ({ one }) => ({
    user: one(user, {
      fields: [agentPrompts.userId],
      references: [user.id],
    }),
    workspace: one(workspaces, {
      fields: [agentPrompts.workspaceId],
      references: [workspaces.id],
    }),
  }),
);
