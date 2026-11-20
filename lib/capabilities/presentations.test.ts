import { describe, expect, it } from "vitest";

import { toolCatalogue } from "./presentations";
import { agentCapabilities } from "./registry";

/**
 * The thread labels a tool call through `toolCatalogue`, which is keyed by
 * capability name. Each context declares its own entries, so the catalogue is a
 * second list of the registry's names and can drift from it: a tool added
 * without an entry reads as a humanised tool name, and one removed leaves a
 * dead entry. Both are failures here rather than a surprise in a conversation.
 *
 * Only agent-callable capabilities can appear in a thread, so only they need an
 * entry; a human-only operation is never a tool call.
 */
describe("tool catalogue", () => {
  it("labels exactly the tools the registry offers the agent", () => {
    const tools = agentCapabilities.map((capability) => capability.name).sort();

    expect(Object.keys(toolCatalogue).sort()).toEqual(tools);
  });

  it("marks exactly the tools the browser performs", () => {
    const client = agentCapabilities
      .filter((capability) => Boolean(capability.client))
      .map((capability) => capability.name)
      .sort();
    const marked = Object.entries(toolCatalogue)
      .filter(([, line]) => line.client)
      .map(([name]) => name)
      .sort();

    expect(marked).toEqual(client);
    expect(client.length).toBeGreaterThan(0);
  });

  it("gives every tool a title the conversation can show", () => {
    for (const line of Object.values(toolCatalogue)) {
      expect(line.present({}).title.trim().length).toBeGreaterThan(0);
    }
  });
});
