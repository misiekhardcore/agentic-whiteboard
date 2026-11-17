import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Stripe delivers a webhook more than once when it does not see a timely 2xx,
 * so event ids are remembered and replays are acknowledged without redoing
 * the work.
 */
export const stripeEvents = pgTable("stripeEvent", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" }).defaultNow().notNull(),
});
