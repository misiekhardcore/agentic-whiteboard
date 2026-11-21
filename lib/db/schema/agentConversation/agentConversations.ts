import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../auth";

/**
 * One agent conversation: the container a person's prompts belong to, inside the
 * account that person was acting as.
 *
 * It exists so a person can leave a thread and start another without losing the
 * first, and it is created lazily with the first prompt. Its id is chosen by the
 * browser (a random UUID) rather than generated here, because "New conversation"
 * is a URL state: the composer knows the id before any prompt has been accepted,
 * so a reload keeps the empty thread instead of falling back to the last one.
 *
 * The account is a nullable organization, the same shape a workspace uses: an
 * organization id, or null for the person's own account. `userId` stays separate
 * because an organization's threads are per member — `organizationId` says which
 * account paid, `userId` says whose thread it is inside that account.
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
    // for its prompts. An organization's conversations are per member, so this
    // stays part of every read alongside the organization.
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // The account the conversation belongs to; null is the person's own.
    organizationId: text("organizationId"),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),

    /**
     * What the switcher calls this conversation. Written from the first prompt
     * when the row is created, then replaced once by a generated title; rows
     * from before titles existed fall back to the first live prompt.
     */
    title: text("title"),

    /**
     * When the generated title replaced the derived one. Null means the label is
     * still the prompt's own words, which is also what makes the refinement a
     * one-time conditional write rather than a race.
     */
    titleGeneratedAt: timestamp("titleGeneratedAt", { precision: 3, mode: "date" }),

    // Bumped when a prompt is accepted, so "the latest conversation" is the one
    // the person last used rather than the one they last created.
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // The dashboard's "latest", the recent list and the history dialog read
    // exactly this tuple: one person's conversations in one account, newest
    // first. The previous (userId, updatedAt) index became a redundant prefix
    // once every read gained the account.
    index("AgentConversation_userId_organization_updatedAt_idx").on(
      table.userId,
      table.organizationId,
      table.updatedAt,
    ),
  ],
);
