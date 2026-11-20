import { describe, expect, it } from "vitest";

import { CONVERSATION_TITLE_MAX_LENGTH, EMPTY_CONVERSATION_TITLE } from "./constants";
import { titleFromPrompt } from "./titleFromPrompt";

describe("titleFromPrompt", () => {
  it("collapses the prompt's line breaks into one line", () => {
    expect(titleFromPrompt("Plan the schema\nand the API")).toBe("Plan the schema and the API");
  });

  it("truncates a long prompt instead of wrapping the switcher", () => {
    const title = titleFromPrompt("a".repeat(CONVERSATION_TITLE_MAX_LENGTH + 10));

    expect(title).toHaveLength(CONVERSATION_TITLE_MAX_LENGTH);
    expect(title.endsWith("…")).toBe(true);
  });

  it("names an empty conversation", () => {
    expect(titleFromPrompt("  \n ")).toBe(EMPTY_CONVERSATION_TITLE);
  });
});
