import { relations } from "drizzle-orm";

import { agentMessages } from "../agentMessage";
import { agentPrompts } from "../agentPrompt";
import { user } from "../auth";
import { canvases } from "../canvas";
import { docs } from "../doc";

import { workspaces } from "./workspaces";

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(user, {
    fields: [workspaces.creatorId],
    references: [user.id],
  }),
  doc: one(docs),
  canvas: one(canvases),
  agentPrompts: many(agentPrompts),
  agentMessages: many(agentMessages),
}));
