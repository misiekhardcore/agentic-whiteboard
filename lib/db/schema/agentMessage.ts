import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspaces } from "./workspace";
import { agentRuns } from "./agentRun";
import {
  AGENT_ACTOR_TYPES,
  AGENT_MESSAGE_ROLES,
} from "../../collab/contracts";

export const agentMessageRoleEnum = pgEnum(
  "AgentMessageRole",
  AGENT_MESSAGE_ROLES,
);

export const agentActorTypeEnum = pgEnum(
  "AgentActorType",
  AGENT_ACTOR_TYPES,
);

/**
 * The shared chat thread for a workspace. Messages are persisted before they
 * are broadcast so a collaborator who joins late can load the same history.
 */
export const agentMessages = pgTable(
  "agentMessage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    runId: text("runId")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),

    role: agentMessageRoleEnum("role").notNull(),

    /** AI SDK message parts, stored verbatim so the UI can replay them. */
    content: jsonb("content").notNull(),

    actorType: agentActorTypeEnum("actorType").notNull(),

    // Human author for USER messages; null for agent/system/tool output.
    userId: text("userId").references(() => user.id, { onDelete: "set null" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("AgentMessage_workspaceId_createdAt_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("AgentMessage_runId_idx").on(table.runId),
  ],
);

export const agentMessagesRelations = relations(
  agentMessages,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [agentMessages.workspaceId],
      references: [workspaces.id],
    }),
    run: one(agentRuns, {
      fields: [agentMessages.runId],
      references: [agentRuns.id],
    }),
    author: one(user, {
      fields: [agentMessages.userId],
      references: [user.id],
    }),
  }),
);

export type AgentMessage = typeof agentMessages.$inferSelect;
