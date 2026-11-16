import { describe, expect, it } from "vitest";

import { deadThreadPrompts } from "./orphans";

describe("which active prompts a send retires", () => {
  it("keeps the prompt this process is streaming", () => {
    expect(
      deadThreadPrompts([{ id: "prompt_live" }, { id: "prompt_dead" }], ["prompt_live"]),
    ).toEqual(["prompt_dead"]);
  });

  it("retires every active prompt when this process streams none", () => {
    expect(deadThreadPrompts([{ id: "prompt_a" }, { id: "prompt_b" }], [])).toEqual([
      "prompt_a",
      "prompt_b",
    ]);
  });

  it("has nothing to retire on a free thread", () => {
    expect(deadThreadPrompts([], ["prompt_live"])).toEqual([]);
  });
});
