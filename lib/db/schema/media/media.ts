import { createId } from "@paralleldrive/cuid2";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { workspaces } from "../workspace";

/**
 * A stored file: an image on a canvas today, an attachment in a conversation or
 * a document later. The row is the file's identity and its access scope; the
 * bytes live in object storage under `storageKey`, never in the database.
 *
 * `workspaceId` is what makes the file part of a workspace, so the workspace's
 * access check and its archive rule decide who may read and write it. A file
 * with no workspace belongs to its uploader alone.
 */
export const media = pgTable(
  "media",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    uploadedByUserId: text("uploadedByUserId").notNull(),

    workspaceId: text("workspaceId").references(() => workspaces.id, { onDelete: "cascade" }),

    mimeType: text("mimeType").notNull(),

    byteSize: integer("byteSize").notNull(),

    storageKey: text("storageKey").notNull().unique(),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("Media_workspaceId_idx").on(table.workspaceId)],
);
