import { createId } from "@paralleldrive/cuid2";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { CanvasSnapshot } from "../../../canvas/contracts";
import { workspaces } from "../workspace";

/**
 * A workspace's canvas surface: the stored projection of its live room.
 *
 * `content` holds the room's snapshot and `revision` is the optimistic check a
 * snapshot write names: the write applies only when the expected revision is
 * still the stored one, so a slow writer cannot replace newer state.
 */
export const canvases = pgTable("canvas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  workspaceId: text("workspaceId")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),

  content: jsonb("content").$type<CanvasSnapshot>(),

  revision: integer("revision").default(0).notNull(),

  createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),

  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
});
