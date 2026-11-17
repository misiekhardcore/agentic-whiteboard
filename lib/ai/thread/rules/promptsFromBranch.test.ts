import { describe, expect, it } from "vitest";

import { promptsFromBranch } from "./promptsFromBranch";

describe("promptsFromBranch", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 16, 12, minute));
  const prompts = [
    { id: "prompt_1", createdAt: at(1) },
    { id: "prompt_2", createdAt: at(2) },
    { id: "prompt_3", createdAt: at(3) },
  ];

  it("keeps the branch prompt and every live prompt after it", () => {
    expect(promptsFromBranch(prompts, { id: "prompt_2", createdAt: at(2) })).toEqual([
      { id: "prompt_2", createdAt: at(2) },
      { id: "prompt_3", createdAt: at(3) },
    ]);
  });

  it("keeps the whole conversation when the first prompt is the branch", () => {
    expect(promptsFromBranch(prompts, { id: "prompt_1", createdAt: at(1) })).toEqual(prompts);
  });

  it("discards from a branch whose prompt an earlier edit already replaced", () => {
    const replaced = { id: "prompt_old", createdAt: at(1.5) };

    expect(promptsFromBranch([prompts[1], prompts[2]], replaced)).toEqual([prompts[1], prompts[2]]);
  });

  it("separates two prompts created in the same millisecond by id", () => {
    expect(
      promptsFromBranch(
        [
          { id: "prompt_a", createdAt: at(4) },
          { id: "prompt_b", createdAt: at(4) },
        ],
        { id: "prompt_a", createdAt: at(4) },
      ).map((prompt) => prompt.id),
    ).toEqual(["prompt_a", "prompt_b"]);
  });

  it("has nothing to discard for a branch after the newest live prompt", () => {
    expect(promptsFromBranch(prompts, { id: "prompt_later", createdAt: at(9) })).toEqual([]);
  });
});
