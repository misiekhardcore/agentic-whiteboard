import { describe, expect, it } from "vitest";

import { renumberPositions } from "./renumberPositions";

describe("renumbering a column", () => {
  it("gives every card a whole step in its existing order", () => {
    expect(renumberPositions(["ws_a", "ws_b", "ws_c"])).toEqual([
      { id: "ws_a", position: 1024 },
      { id: "ws_b", position: 2048 },
      { id: "ws_c", position: 3072 },
    ]);
  });

  it("renumbers an empty column to nothing", () => {
    expect(renumberPositions([])).toEqual([]);
  });
});
