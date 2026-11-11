import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspaces } from "./workspace";
import { agentMessages } from "./agentMessage";

export const agentRunStatusEnum = pgEnum("AgentRunStatus", [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const agentRuns = pgTable(
  "agentRun",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Denormalized at creation time so quota/audit remain correct if the
    // workspace later moves between accounts.
    orgId: text("orgId"),

    requestedByUserId: text("requestedByUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    status: agentRunStatusEnum("status").default("QUEUED").notNull(),

    provider: text("provider").notNull(),
    model: text("model").notNull(),

    /** The AI SDK usage object, kept for quotas and cost reporting. */
    usage: jsonb("usage"),
    error: text("error"),

    startedAt: timestamp("startedAt", { precision: 3, mode: "date" }),
    finishedAt: timestamp("finishedAt", { precision: 3, mode: "date" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("AgentRun_workspaceId_createdAt_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("AgentRun_requestedByUserId_createdAt_idx").on(
      table.requestedByUserId,
      table.createdAt,
    ),
    // One agent may write to a workspace at a time. Concurrent intents would
    // be merged by Yjs but could still fight over the same semantic edit.
    uniqueIndex("AgentRun_one_active_per_workspace_idx")
      .on(table.workspaceId)
      .where(sql`${table.status} in ('QUEUED', 'RUNNING')`),
  ],
);

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [agentRuns.workspaceId],
    references: [workspaces.id],
  }),
  requester: one(user, {
    fields: [agentRuns.requestedByUserId],
    references: [user.id],
  }),
  messages: many(agentMessages),
}));

export type AgentRun = typeof agentRuns.$inferSelect;
