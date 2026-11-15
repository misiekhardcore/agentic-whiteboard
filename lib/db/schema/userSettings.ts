import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Preferences the person owns regardless of which organization they are
 * viewing. They live in their own table rather than on `user` so the auth row
 * keeps belonging to better-auth, and a new personal setting is a column here
 * instead of another widening of a shared table.
 *
 * A row appears the first time someone changes a setting; the defaults in this
 * module are what an absent row means.
 */
export const userSettings = pgTable("userSettings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Whether the agent's replies are read out loud as they stream. */
  readAloud: boolean("read_aloud").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
