import { describe, expect, it } from "vitest";

import { CONVERSATION_PREVIEW_LENGTH } from "./CONVERSATION_PREVIEW_LENGTH";
import { conversationPreview } from "./conversationPreview";

describe("conversationPreview", () => {
  it("collapses the prompt's line breaks into one line", () => {
    expect(conversationPreview("Plan the schema\nand the API")).toBe("Plan the schema and the API");
  });

  it("truncates a long prompt instead of wrapping the switcher", () => {
    const preview = conversationPreview("a".repeat(CONVERSATION_PREVIEW_LENGTH + 10));

    expect(preview).toHaveLength(CONVERSATION_PREVIEW_LENGTH);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("names an empty conversation", () => {
    expect(conversationPreview("  \n ")).toBe("New conversation");
  });
});
