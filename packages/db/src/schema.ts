import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The skeleton's metadata row. It is what `workspace.read` authorizes against;
 * the document itself lives in the room owner, never in this table.
 */
export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    name: text("name").notNull(),
    docRoomId: text("doc_room_id").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workspace_account_id_idx").on(table.accountId)],
);

export type WorkspaceRow = typeof workspace.$inferSelect;
export type NewWorkspaceRow = typeof workspace.$inferInsert;
