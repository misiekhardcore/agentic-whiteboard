import { customType, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Raw Yjs updates and other binary projections. */
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

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

/**
 * The durable copy of a document room: the Yjs state a room loads when it
 * opens. Only the document room owner writes this table; nothing else may
 * update a document body. The content revision lives inside the Yjs state, not
 * in a second column that could disagree with it.
 */
export const docRoom = pgTable("doc_room", {
  roomId: text("room_id").primaryKey(),
  yjsState: bytea("yjs_state"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Which document service instance holds a room. A live lease is exclusive, so a
 * second instance refuses the room instead of letting two owners overwrite each
 * other; an expired lease can be taken over by the next instance.
 */
export const docRoomLease = pgTable(
  "doc_room_lease",
  {
    roomId: text("room_id").primaryKey(),
    holder: text("holder").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("doc_room_lease_expires_at_idx").on(table.expiresAt)],
);

export type WorkspaceRow = typeof workspace.$inferSelect;
export type NewWorkspaceRow = typeof workspace.$inferInsert;
