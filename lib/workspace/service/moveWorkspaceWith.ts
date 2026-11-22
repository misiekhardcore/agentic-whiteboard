import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { failure } from "@/lib/capabilities/define";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

import type { WorkspaceAccess } from "../access";
import type { WorkspaceRequester } from "../activity";
import type { WorkspaceMoveInput, WorkspaceMutationResult } from "../contracts";
import {
  abortRefusal,
  positionBetween,
  type RenumberedPosition,
  renumberPositions,
  stageMoveActivity,
  WORKSPACE_ARCHIVED_MOVE_MESSAGE,
  WORKSPACE_NOT_FOUND_MESSAGE,
  WORKSPACE_POSITION_STEP,
  workspaceActivityFor,
} from "../rules";
import type { WorkspaceStatus } from "../status";

import { recordActivityWith } from "./recordActivityWith";

type ColumnRow = { id: string; position: number };
type ColumnPlacement = { position: number; renumbered: RenumberedPosition[] };

/**
 * The target column as the move sees it: the workspace's own account, the new
 * stage, no archived rows, and never the card being moved. Scoping by the
 * workspace's account rather than the browser's active account is what makes a
 * foreign neighbour resolve as absent instead of joining the column.
 */
function targetColumnWhere(access: WorkspaceAccess, status: WorkspaceStatus) {
  // `and` is typed as possibly-empty; with four conditions it always returns SQL.
  return and(
    access.organizationId
      ? eq(workspaces.orgId, access.organizationId)
      : and(eq(workspaces.creatorId, access.workspace.creatorId), isNull(workspaces.orgId)),
    eq(workspaces.status, status),
    isNull(workspaces.archivedAt),
    ne(workspaces.id, access.workspace.id),
  )!;
}

/**
 * The position the move writes, and the whole-step renumber when the gap between
 * the named neighbours is exhausted. A named neighbour that is not in the
 * column - gone, archived or another account's - appends instead of refusing,
 * so a drop made against a stale board still lands somewhere sensible.
 */
function resolvePlacement(
  column: readonly ColumnRow[],
  { previousId, nextId }: Pick<WorkspaceMoveInput, "previousId" | "nextId">,
): ColumnPlacement {
  const previous =
    previousId === undefined ? undefined : column.find((row) => row.id === previousId);
  const next = nextId === undefined ? undefined : column.find((row) => row.id === nextId);
  const staleNeighbour = (previousId !== undefined && !previous) || (nextId !== undefined && !next);

  if (staleNeighbour) {
    const last = column.at(-1);
    return { position: last ? last.position + WORKSPACE_POSITION_STEP : 0, renumbered: [] };
  }

  const placement = positionBetween({
    previous: previous?.position ?? null,
    next: next?.position ?? null,
  });
  if (placement.kind === "position") return { position: placement.position, renumbered: [] };

  const renumbered = renumberPositions(column.map((row) => row.id));
  const previousIndex = column.findIndex((row) => row.id === previousId);
  const nextIndex = column.findIndex((row) => row.id === nextId);

  return {
    position: (renumbered[previousIndex].position + renumbered[nextIndex].position) / 2,
    renumbered,
  };
}

/**
 * Writes a stage and an order as one intent. The browser names the cards the
 * dragged one lands between and the server derives the value, inside one
 * transaction that also renumbers the column when precision runs out and
 * records the stage move, so a half-applied or unrecorded move cannot exist.
 */
export async function moveWorkspaceWith(
  access: WorkspaceAccess,
  requester: WorkspaceRequester,
  input: WorkspaceMoveInput,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WorkspaceMutationResult> {
  const stopped = abortRefusal(signal);
  if (stopped) return stopped;

  // An archived workspace has no column on the board; a stale tab dragging one
  // must not write a stage the board will never show.
  if (access.workspace.archivedAt) return failure(WORKSPACE_ARCHIVED_MOVE_MESSAGE);

  return db.transaction(async (tx) => {
    // Two people (or an agent) dropping into one column at the same moment must
    // not both derive from the same neighbour positions.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('workspace_move'), hashtext(${access.workspace.id}))`,
    );

    const column = await tx
      .select({ id: workspaces.id, position: workspaces.position })
      .from(workspaces)
      .where(targetColumnWhere(access, input.status))
      .orderBy(asc(workspaces.position), asc(workspaces.id));

    const placement = resolvePlacement(column, input);

    for (const row of placement.renumbered) {
      await tx
        .update(workspaces)
        .set({ position: row.position })
        .where(eq(workspaces.id, row.id))
        .returning({ id: workspaces.id });
    }

    const [updated] = await tx
      .update(workspaces)
      .set({ status: input.status, position: placement.position })
      .where(eq(workspaces.id, access.workspace.id))
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        status: workspaces.status,
      });

    if (!updated) return failure(WORKSPACE_NOT_FOUND_MESSAGE);

    await recordActivityWith(
      tx,
      workspaceActivityFor(
        updated.id,
        stageMoveActivity(access.workspace.status, input.status),
        requester,
      ),
    );

    return { ok: true as const, workspace: updated };
  });
}
