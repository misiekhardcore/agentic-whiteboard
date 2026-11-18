import type { subscriptions } from "./subscriptions";

export type Subscription = typeof subscriptions.$inferSelect;

export type NewSubscription = typeof subscriptions.$inferInsert;
