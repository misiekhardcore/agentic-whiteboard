import type { subscriptions } from "@/lib/db/schema";

export type SubscriptionRow = typeof subscriptions.$inferSelect;
