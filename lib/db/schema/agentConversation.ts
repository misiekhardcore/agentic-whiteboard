import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agentPrompts } from "./agentPrompt";
import { user } from "./auth";

/**
 * One agent conversation: the container a person's prompts belong to.
 *
 * It exists so a person can leave a thread and start another without losing the
 * first, and it is created lazily with the first prompt. Its id is chosen by the
 * browser (a random UUID) rather than generated here, because "New conversation"
 * is a URL state: the composer knows the id before any prompt has been accepted,
 * so a reload keeps the empty thread instead of falling back to the last one.
 *
 * `workspaceId` is deliberately absent. Only the dashboard thread has
 * conversations today; a workspace conversation would add that column rather than
 * reuse this row, because its access rule is the workspace's, not the person's.
 */
export const agentConversations = pgTable(
  "agentConversation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // The person whose conversation this is, independent of the account paying
    // for its prompts.
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),

    // Bumped when a prompt is accepted, so "the latest conversation" is the one
    // the person last used rather than the one they last created.
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // The dashboard's "latest" and recent list read exactly this tuple.
    index("AgentConversation_userId_updatedAt_idx").on(table.userId, table.updatedAt),
  ],
);

export const agentConversationsRelations = relations(agentConversations, ({ one, many }) => ({
  user: one(user, {
    fields: [agentConversations.userId],
    references: [user.id],
  }),
  prompts: many(agentPrompts),
}));

export type AgentConversation = typeof agentConversations.$inferSelect;
