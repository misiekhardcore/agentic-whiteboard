import { WORKSPACE_POSITION_STEP } from "./constants";

export type RenumberedPosition = { id: string; position: number };

/**
 * Turns a column's order into whole steps. Only a move that exhausted the gap
 * between two neighbours calls this, and it rewrites that one column, so the
 * board keeps its order while the next insert has room again.
 */
export function renumberPositions(orderedIds: readonly string[]): RenumberedPosition[] {
  return orderedIds.map((id, index) => ({
    id,
    position: (index + 1) * WORKSPACE_POSITION_STEP,
  }));
}
