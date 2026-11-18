import { relations } from "drizzle-orm";

import { agentPrompts } from "../agentPrompt";
import { user } from "../auth";

import { agentConversations } from "./agentConversations";

export const agentConversationsRelations = relations(agentConversations, ({ one, many }) => ({
  user: one(user, {
    fields: [agentConversations.userId],
    references: [user.id],
  }),
  prompts: many(agentPrompts),
}));
