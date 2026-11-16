import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { AGENT_PROMPT_STATUSES } from "../../collab/contracts";

import { agentConversations } from "./agentConversation";
import { agentMessages } from "./agentMessage";
import { user } from "./auth";
import { workspaces } from "./workspace";

export const agentPromptStatusEnum = pgEnum("AgentPromptStatus", AGENT_PROMPT_STATUSES);

/**
 * One accepted prompt: the prompt itself, the execution it started and the row
 * the plan allowance counts are the same record. A rejected prompt (out of
 * prompts, provider not configured) writes nothing, and queued work is a
 * status, so there is no second ledger to keep in sync.
 *
 * `workspaceId` is null for the dashboard's planning thread, where the prompt
 * belongs to the person and the agent may create a workspace with a tool; there
 * `conversationId` says which of that person's conversations it continues.
 */
export const agentPrompts = pgTable(
  "agentPrompt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // The paying account: an organization id, or the user id for a personal
    // account. Snapshotted so the monthly count and audit survive a workspace
    // or membership change.
    ownerId: text("ownerId").notNull(),

    // The member whose per-person allowance this prompt consumes. It is also
    // the owner of the planning thread when `workspaceId` is null.
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Null is the user's dashboard thread. Archiving is the supported way to
    // retire a workspace; a hard delete takes its prompt history with it.
    workspaceId: text("workspaceId").references(() => workspaces.id, {
      onDelete: "cascade",
    }),

    // The dashboard conversation this prompt continues. Null for a workspace
    // prompt and for rows written before conversations existed (the migration
    // backfills those into one per person).
    conversationId: text("conversationId").references(() => agentConversations.id, {
      onDelete: "cascade",
    }),

    status: agentPromptStatusEnum("status").default("QUEUED").notNull(),

    provider: text("provider").notNull(),
    model: text("model").notNull(),

    /** The AI SDK usage object, kept for quotas and cost reporting. */
    usage: jsonb("usage"),
    error: text("error"),

    /**
     * The prompt is no longer part of its conversation: an edit (or a rewind)
     * replaced it and everything after it. The row stays for the allowance
     * count and the audit trail, so discarding a turn never costs history.
     */
    supersededAt: timestamp("supersededAt", { precision: 3, mode: "date" }),

    startedAt: timestamp("startedAt", { precision: 3, mode: "date" }),
    finishedAt: timestamp("finishedAt", { precision: 3, mode: "date" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // The monthly per-member count reads exactly this tuple.
    index("AgentPrompt_ownerId_userId_createdAt_idx").on(
      table.ownerId,
      table.userId,
      table.createdAt,
    ),
    // Loading a person's planning thread.
    index("AgentPrompt_userId_createdAt_idx").on(table.userId, table.createdAt),
    // A workspace's chat history.
    index("AgentPrompt_workspaceId_createdAt_idx").on(table.workspaceId, table.createdAt),
    // Loading one conversation's live prompts, in order.
    index("AgentPrompt_conversationId_createdAt_idx").on(table.conversationId, table.createdAt),
    // One agent may write to a workspace at a time.
    uniqueIndex("AgentPrompt_one_active_per_workspace_idx")
      .on(table.workspaceId)
      .where(sql`${table.status} in ('QUEUED', 'RUNNING')`),
    // The dashboard thread is per person, so it has its own single-flight rule.
    uniqueIndex("AgentPrompt_one_active_per_user_thread_idx")
      .on(table.userId)
      .where(sql`${table.workspaceId} is null and ${table.status} in ('QUEUED', 'RUNNING')`),
  ],
);

export const agentPromptsRelations = relations(agentPrompts, ({ one, many }) => ({
  user: one(user, {
    fields: [agentPrompts.userId],
    references: [user.id],
  }),
  workspace: one(workspaces, {
    fields: [agentPrompts.workspaceId],
    references: [workspaces.id],
  }),
  conversation: one(agentConversations, {
    fields: [agentPrompts.conversationId],
    references: [agentConversations.id],
  }),
  messages: many(agentMessages),
}));

export type AgentPrompt = typeof agentPrompts.$inferSelect;
