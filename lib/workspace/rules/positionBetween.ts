import { WORKSPACE_POSITION_MIN_GAP, WORKSPACE_POSITION_STEP } from "./constants";

export type PositionPlacement =
  | { kind: "position"; position: number }
  /** The gap is too small to halve again; the column must be renumbered first. */
  | { kind: "renumber" };

/**
 * Where a card lands between the two neighbours it named. A missing previous or
 * next means the card sits at that end of the column, one whole step from the
 * surviving neighbour; an empty column starts at zero.
 *
 * A gap below the minimum, or neighbours in the wrong order, cannot be halved
 * into a distinct value, so the move asks for a renumber rather than writing a
 * position that ties or inverts the order.
 */
export function positionBetween({
  previous,
  next,
}: {
  previous: number | null;
  next: number | null;
}): PositionPlacement {
  if (previous === null) {
    return { kind: "position", position: next === null ? 0 : next - WORKSPACE_POSITION_STEP };
  }
  if (next === null) return { kind: "position", position: previous + WORKSPACE_POSITION_STEP };

  const gap = next - previous;
  if (gap < WORKSPACE_POSITION_MIN_GAP) return { kind: "renumber" };

  return { kind: "position", position: previous + gap / 2 };
}
