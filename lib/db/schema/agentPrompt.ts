import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { workspaces } from "./workspace";

export const agentPrompts = pgTable(
  "AgentPrompt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // The paying account: an organization id, or the user id for a personal
    // account. `userId` below is the member whose per-person quota this prompt
    // consumes, so the monthly count is `(ownerId, userId, createdAt)`.
    ownerId: text("ownerId").notNull(),

    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    workspaceId: text("workspaceId").references(() => workspaces.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("AgentPrompt_ownerId_createdAt_idx").on(table.ownerId, table.createdAt)],
);

export const agentPromptsRelations = relations(agentPrompts, ({ one }) => ({
  user: one(user, {
    fields: [agentPrompts.userId],
    references: [user.id],
  }),
  workspace: one(workspaces, {
    fields: [agentPrompts.workspaceId],
    references: [workspaces.id],
  }),
}));
