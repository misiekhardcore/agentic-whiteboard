import { relations } from "drizzle-orm";

import { agentConversations } from "../agentConversation";
import { agentMessages } from "../agentMessage";
import { user } from "../auth";
import { workspaces } from "../workspace";

import { agentPrompts } from "./agentPrompts";

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
