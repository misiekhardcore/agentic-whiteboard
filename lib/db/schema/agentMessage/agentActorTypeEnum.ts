import { pgEnum } from "drizzle-orm/pg-core";

import { AGENT_ACTOR_TYPES } from "../../../collab/contracts";

export const agentActorTypeEnum = pgEnum("AgentActorType", AGENT_ACTOR_TYPES);
