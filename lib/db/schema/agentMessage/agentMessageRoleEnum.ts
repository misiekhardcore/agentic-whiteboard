import { pgEnum } from "drizzle-orm/pg-core";

import { AGENT_MESSAGE_ROLES } from "../../../collab/contracts";

export const agentMessageRoleEnum = pgEnum("AgentMessageRole", AGENT_MESSAGE_ROLES);
