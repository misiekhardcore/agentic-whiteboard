import { createId } from "@paralleldrive/cuid2";
import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { WorkspaceActivityDetails } from "../../../workspace/activity";
import { workspaces } from "../workspace";

import { workspaceActivityActorTypeEnum } from "./workspaceActivityActorTypes";
import { workspaceActivityKindEnum } from "./workspaceActivityKinds";
import { workspaceActivitySurfaceEnum } from "./workspaceActivitySurfaces";

/**
 * The append-only history of a workspace: one row per thing that happened, so
 * "how did this get here" is read rather than reconstructed from timestamps.
 *
 * There is no `updatedAt` and nothing edits or deletes a row; the only delete
 * is the cascade that removes the workspace, because nothing can read the
 * history of a row that no longer exists. `actorUserId` names the person the
 * change was requested by even when the agent made it, and carries no foreign
 * key: a person leaving must not erase what happened to the workspace.
 *
 * `sequence` is the insertion order, assigned by the database. Rows written by
 * one change share `createdAt` (a transaction's `now()`), so the history needs
 * a second, monotonic value to order them and to resume paging after them.
 */
export const workspaceActivities = pgTable(
  "workspaceActivity",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    surface: workspaceActivitySurfaceEnum("surface").notNull(),

    kind: workspaceActivityKindEnum("kind").notNull(),

    actorType: workspaceActivityActorTypeEnum("actorType").notNull(),

    actorUserId: text("actorUserId").notNull(),

    /** What changed, typed by the rules module: field values and stage ends only. */
    details: jsonb("details").$type<WorkspaceActivityDetails>().notNull(),

    /** Insertion order: the tiebreak inside one instant, for reading and paging. */
    sequence: bigserial("sequence", { mode: "number" }).notNull(),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    // The history read and its "load older" cursor both order by these columns.
    index("WorkspaceActivity_workspaceId_createdAt_sequence_idx").on(
      table.workspaceId,
      table.createdAt,
      table.sequence,
    ),
  ],
);
