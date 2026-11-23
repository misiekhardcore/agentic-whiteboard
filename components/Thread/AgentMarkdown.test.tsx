// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentMarkdown } from "./AgentMarkdown";

describe("AgentMarkdown table rendering", () => {
  it("renders a GFM table with proper structure", () => {
    const { container } = render(
      <AgentMarkdown>{"| Name | Age |\n| --- | --- |\n| Ana | 30 |"}</AgentMarkdown>,
    );

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector("thead")).not.toBeNull();
    expect(table?.querySelector("tbody")).not.toBeNull();
    expect(table?.querySelector("th")).not.toBeNull();
    expect(table?.querySelector("td")).not.toBeNull();
  });
});
