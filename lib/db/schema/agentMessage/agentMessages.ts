import { createId } from "@paralleldrive/cuid2";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agentPrompts } from "../agentPrompt";
import { user } from "../auth";
import { workspaces } from "../workspace";

import { agentActorTypeEnum } from "./agentActorTypeEnum";
import { agentMessageRoleEnum } from "./agentMessageRoleEnum";

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

    /**
     * The message is no longer shown while its prompt still is: a retry replaces
     * the reply a failed attempt left behind without opening a second prompt. A
     * discarded turn is reached through the prompt's own `supersededAt` instead,
     * so nothing is deleted and the monthly prompt count never changes.
     */
    supersededAt: timestamp("supersededAt", { precision: 3, mode: "date" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("AgentMessage_workspaceId_createdAt_idx").on(table.workspaceId, table.createdAt),
    index("AgentMessage_promptId_idx").on(table.promptId),
  ],
);
