import { describe, expect, it } from "vitest";

import { CLIENT_TOOL_NAMES, toolPresentations } from "./presentations";
import { agentCapabilities } from "./registry";

/**
 * The thread labels a tool call through `toolPresentations`, which is keyed by
 * capability name. That map is a second list of the same names, so it can drift
 * from the registry — a tool added without a presenter reads as a humanised
 * tool name, and one removed leaves a dead entry. Both are failures here rather
 * than a surprise in a conversation.
 *
 * Only agent-callable capabilities can appear in a thread, so only they need a
 * presenter; a human-only operation is never a tool call.
 */
describe("tool presentations", () => {
  it("labels exactly the tools the registry offers the agent", () => {
    const tools = agentCapabilities.map((capability) => capability.name).sort();

    expect(Object.keys(toolPresentations).sort()).toEqual(tools);
  });

  it("marks exactly the client capabilities as browser-performed", () => {
    const client = agentCapabilities
      .filter((capability) => capability.client)
      .map((capability) => capability.name)
      .sort();

    expect([...CLIENT_TOOL_NAMES].sort()).toEqual(client);
  });
});
