import { describe, expect, it } from "vitest";

import { CONVERSATION_TITLE_MAX_LENGTH } from "./constants";
import { generatedConversationTitle } from "./generatedConversationTitle";

describe("generatedConversationTitle", () => {
  it("takes the Title: line the request asks for", () => {
    expect(generatedConversationTitle("Title: Sprint planning for the whiteboard")).toBe(
      "Sprint planning for the whiteboard",
    );
    expect(generatedConversationTitle("Here is a name:\nTitle: Sprint planning")).toBe(
      "Sprint planning",
    );
  });

  it("ignores whatever the model wrote after the title line", () => {
    expect(generatedConversationTitle("Title: Sprint planning\nThis is why I chose it.")).toBe(
      "Sprint planning",
    );
  });

  it("drops the quotes and ending punctuation a model tends to add", () => {
    expect(generatedConversationTitle('Title: "Plan the schema."')).toBe("Plan the schema");
    expect(generatedConversationTitle("Title: “Design the API!”")).toBe("Design the API");
    expect(generatedConversationTitle("Title: Sprint planning: the sequel;")).toBe(
      "Sprint planning: the sequel",
    );
  });

  it("accepts the marker wrapped in the emphasis a model likes", () => {
    expect(generatedConversationTitle("**Title:** Design the API")).toBe("Design the API");
    expect(generatedConversationTitle("**Title**: Design the API")).toBe("Design the API");
  });

  it("has nothing usable when the model answered with nothing", () => {
    expect(generatedConversationTitle("")).toBeNull();
    expect(generatedConversationTitle("  \n \t ")).toBeNull();
    expect(generatedConversationTitle("Title:")).toBeNull();
    expect(generatedConversationTitle('Title: ""')).toBeNull();
  });

  it("refuses an answer that does not carry a title line", () => {
    expect(
      generatedConversationTitle(
        "I cannot answer this question as asked because the app was not named.",
      ),
    ).toBeNull();
  });

  it("cuts a title that is longer than a pill can hold", () => {
    const title = generatedConversationTitle(
      `Title: ${"a".repeat(CONVERSATION_TITLE_MAX_LENGTH + 10)}`,
    );

    expect(title).toHaveLength(CONVERSATION_TITLE_MAX_LENGTH);
    expect(title?.endsWith(" ")).toBe(false);
  });
});
