import { pgEnum } from "drizzle-orm/pg-core";

import { AGENT_PROMPT_STATUSES } from "../../../collab/contracts";

export const agentPromptStatusEnum = pgEnum("AgentPromptStatus", AGENT_PROMPT_STATUSES);
