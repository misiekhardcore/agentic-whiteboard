import { createId } from "@paralleldrive/cuid2";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A stored file's identity: its uploader, the account that may read it, type,
 * size and the key its bytes live under in object storage. The bytes never
 * enter the database.
 *
 * `orgId` is the file's whole scope. It is the account the canvas that uploaded
 * it belongs to, so every member of that account can open it from any board; a
 * canvas keeps the reference and the file keeps no workspace. A null `orgId` is
 * a personal file, which is its uploader's alone.
 */
export const media = pgTable(
  "media",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    uploadedByUserId: text("uploadedByUserId").notNull(),

    orgId: text("orgId"),

    mimeType: text("mimeType").notNull(),

    byteSize: integer("byteSize").notNull(),

    storageKey: text("storageKey").notNull().unique(),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("Media_storageKey_idx").on(table.storageKey),
    index("Media_orgId_idx").on(table.orgId),
  ],
);
