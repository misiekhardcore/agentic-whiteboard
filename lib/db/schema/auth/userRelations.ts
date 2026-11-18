import { relations } from "drizzle-orm";

import { agentConversations } from "../agentConversation";
import { agentMessages } from "../agentMessage";
import { agentPrompts } from "../agentPrompt";
import { workspaces } from "../workspace";

import { account } from "./account";
import { invitation } from "./invitation";
import { member } from "./member";
import { session } from "./session";
import { user } from "./user";

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  createdWorkspaces: many(workspaces),
  agentConversations: many(agentConversations),
  agentPrompts: many(agentPrompts),
  agentMessages: many(agentMessages),
  members: many(member),
  invitations: many(invitation),
}));
