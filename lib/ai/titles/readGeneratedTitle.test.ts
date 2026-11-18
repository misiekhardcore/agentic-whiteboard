import { describe, expect, it } from "vitest";

import { CONVERSATION_TITLE_MAX_LENGTH } from "./constants";
import { readGeneratedTitle } from "./readGeneratedTitle";

describe("readGeneratedTitle", () => {
  it("keeps a plain answer as it is", () => {
    expect(readGeneratedTitle("Food delivery schema")).toBe("Food delivery schema");
  });

  it("takes the first usable line when the model explains itself", () => {
    expect(readGeneratedTitle("Food delivery schema\n\nThis title describes the request.")).toBe(
      "Food delivery schema",
    );
    expect(readGeneratedTitle("\n  Food delivery schema  \n")).toBe("Food delivery schema");
  });

  it("removes a label, wrapping quotes and a code fence", () => {
    expect(readGeneratedTitle('Title: "Food delivery schema"')).toBe("Food delivery schema");
    expect(readGeneratedTitle("Chat title: `Food delivery schema`")).toBe("Food delivery schema");
    expect(readGeneratedTitle("```text\nFood delivery schema\n```")).toBe("Food delivery schema");
    expect(readGeneratedTitle("**Food delivery schema**")).toBe("Food delivery schema");
  });

  it("drops a trailing period but keeps a question", () => {
    expect(readGeneratedTitle("Food delivery schema.")).toBe("Food delivery schema");
    expect(readGeneratedTitle("Why is the schema slow?")).toBe("Why is the schema slow?");
  });

  it("clamps a long answer", () => {
    const title = readGeneratedTitle("a".repeat(CONVERSATION_TITLE_MAX_LENGTH + 20));

    expect(title).toHaveLength(CONVERSATION_TITLE_MAX_LENGTH);
    expect(title?.endsWith("…")).toBe(true);
  });

  it("returns nothing usable as null, so the derived title stays", () => {
    expect(readGeneratedTitle("")).toBeNull();
    expect(readGeneratedTitle("   \n\t")).toBeNull();
    expect(readGeneratedTitle("Title:")).toBeNull();
    expect(readGeneratedTitle('""')).toBeNull();
  });
});
