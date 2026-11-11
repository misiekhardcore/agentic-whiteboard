import { describe, expect, it } from "vitest";

import { agentActorTypeEnum, agentMessageRoleEnum } from "../db/schema/agentMessage";
import { agentRunStatusEnum } from "../db/schema/agentRun";
import {
  AGENT_ACTOR_TYPES,
  AGENT_MESSAGE_ROLES,
  AGENT_RUN_STATUSES,
} from "./contracts";

describe("agent enums", () => {
  it("derives the Postgres enums from the collaboration contracts", () => {
    expect(agentRunStatusEnum.enumValues).toEqual([...AGENT_RUN_STATUSES]);
    expect(agentMessageRoleEnum.enumValues).toEqual([...AGENT_MESSAGE_ROLES]);
    expect(agentActorTypeEnum.enumValues).toEqual([...AGENT_ACTOR_TYPES]);
  });

  it("stores tool output as a message part, not as a TOOL role", () => {
    // Mirrors UIMessage["role"] in the AI SDK; see the persistence guide.
    expect([...agentMessageRoleEnum.enumValues].sort()).toEqual([
      "ASSISTANT",
      "SYSTEM",
      "USER",
    ]);
  });
});
