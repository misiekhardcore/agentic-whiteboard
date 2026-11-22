import { describe, expect, it } from "vitest";

import { positionBetween } from "./positionBetween";

describe("placing a workspace between two neighbours", () => {
  it("lands halfway between the cards it is dropped between", () => {
    expect(positionBetween({ previous: 1024, next: 3072 })).toEqual({
      kind: "position",
      position: 2048,
    });
  });

  it("places the first card of a column before the only neighbour", () => {
    expect(positionBetween({ previous: null, next: 1024 })).toEqual({
      kind: "position",
      position: 0,
    });
  });

  it("appends after the last card of a column", () => {
    expect(positionBetween({ previous: 1024, next: null })).toEqual({
      kind: "position",
      position: 2048,
    });
  });

  it("places the only card of an empty column at the start", () => {
    expect(positionBetween({ previous: null, next: null })).toEqual({
      kind: "position",
      position: 0,
    });
  });

  it("asks for a renumber when the gap is smaller than a double can separate", () => {
    expect(positionBetween({ previous: 1024, next: 1024 + 1e-7 })).toEqual({
      kind: "renumber",
    });
  });

  it("asks for a renumber when the neighbours are out of order", () => {
    expect(positionBetween({ previous: 3072, next: 1024 })).toEqual({ kind: "renumber" });
  });
});
