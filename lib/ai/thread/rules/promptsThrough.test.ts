import { describe, expect, it } from "vitest";

import { promptsThrough } from "./promptsThrough";

describe("promptsThrough", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 16, 12, minute));
  const prompts = [
    { id: "prompt_1", createdAt: at(1) },
    { id: "prompt_2", createdAt: at(2) },
    { id: "prompt_3", createdAt: at(3) },
  ];

  it("keeps every prompt up to and including the turn", () => {
    expect(promptsThrough(prompts, { id: "prompt_2", createdAt: at(2) })).toEqual([
      { id: "prompt_1", createdAt: at(1) },
      { id: "prompt_2", createdAt: at(2) },
    ]);
  });

  it("has only the first prompt when the turn is the first one", () => {
    expect(promptsThrough(prompts, { id: "prompt_1", createdAt: at(1) })).toEqual([
      { id: "prompt_1", createdAt: at(1) },
    ]);
  });

  it("has nothing for a turn older than the whole live thread", () => {
    expect(promptsThrough(prompts, { id: "prompt_old", createdAt: at(0) })).toEqual([]);
  });

  it("separates two prompts created in the same millisecond by id", () => {
    expect(
      promptsThrough(
        [
          { id: "prompt_a", createdAt: at(4) },
          { id: "prompt_b", createdAt: at(4) },
        ],
        { id: "prompt_a", createdAt: at(4) },
      ).map((prompt) => prompt.id),
    ).toEqual(["prompt_a"]);
  });
});
