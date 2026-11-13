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
import { agentPrompts } from "./agentPrompt";
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
 * The chat thread of a prompt. Messages are persisted before they are broadcast
 * so a collaborator who joins late can load the same history.
 *
 * `workspaceId` always mirrors the prompt's: null for the dashboard planning
 * thread, set for a workspace conversation.
 */
export const agentMessages = pgTable(
  "agentMessage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    workspaceId: text("workspaceId").references(() => workspaces.id, {
      onDelete: "cascade",
    }),

    promptId: text("promptId")
      .notNull()
      .references(() => agentPrompts.id, { onDelete: "cascade" }),

    role: agentMessageRoleEnum("role").notNull(),

    /**
     * AI SDK `UIMessage` parts, stored verbatim so the UI can replay them.
     * Tool calls and results are parts on an assistant message, so no message
     * uses a TOOL role.
     */
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
    index("AgentMessage_promptId_idx").on(table.promptId),
  ],
);

export const agentMessagesRelations = relations(
  agentMessages,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [agentMessages.workspaceId],
      references: [workspaces.id],
    }),
    prompt: one(agentPrompts, {
      fields: [agentMessages.promptId],
      references: [agentPrompts.id],
    }),
    author: one(user, {
      fields: [agentMessages.userId],
      references: [user.id],
    }),
  }),
);

export type AgentMessage = typeof agentMessages.$inferSelect;
