import { relations } from "drizzle-orm";

import { agentPrompts } from "../agentPrompt";
import { user } from "../auth";
import { workspaces } from "../workspace";

import { agentMessages } from "./agentMessages";

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
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
}));
