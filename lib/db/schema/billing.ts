import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Who pays for a subscription. A user buys a personal plan, an organization
 * buys a team plan; `ownerId` points at the matching table's id.
 */
export const billingOwnerTypeEnum = pgEnum("BillingOwnerType", [
  "USER",
  "ORGANIZATION",
]);

/**
 * One row per Stripe subscription. A canceled subscription keeps its row and a
 * later resubscription adds a new one, so history survives.
 */
export const subscriptions = pgTable(
  "subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    ownerType: billingOwnerTypeEnum("ownerType").notNull(),
    ownerId: text("ownerId").notNull(),

    /** Plan catalog id: "pro", "team" or "enterprise". */
    plan: text("plan").notNull(),
    /** Stripe subscription status, kept verbatim (active, past_due, ...). */
    status: text("status").notNull(),
    /** Licensed seats, i.e. the quantity billed on per-member plans. */
    seats: integer("seats").default(1).notNull(),

    stripeCustomerId: text("stripeCustomerId").notNull(),
    stripeSubscriptionId: text("stripeSubscriptionId").notNull().unique(),
    stripePriceId: text("stripePriceId").notNull(),
    /**
     * ISO code of the price Stripe billed, lowercase as Stripe reports it. The
     * code is mirrored from Stripe rather than assumed from the catalog, so a
     * subscription bought in another currency keeps its own once the catalog
     * offers more than one.
     */
    currency: text("currency").default("usd").notNull(),
    /**
     * The recurring interval of the price Stripe bills (month, year, ...). It
     * comes from Stripe with the currency, so the billing cycle shown to the
     * customer is the one they are actually charged on, not a catalog guess.
     */
    billingInterval: text("billingInterval").default("month").notNull(),

    /** When Stripe says the subscription began. */
    startedAt: timestamp("startedAt", { precision: 3, mode: "date" }),

    currentPeriodStart: timestamp("currentPeriodStart", {
      precision: 3,
      mode: "date",
    }),
    currentPeriodEnd: timestamp("currentPeriodEnd", {
      precision: 3,
      mode: "date",
    }),

    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
    canceledAt: timestamp("canceledAt", { precision: 3, mode: "date" }),
    endedAt: timestamp("endedAt", { precision: 3, mode: "date" }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Subscription_owner_idx").on(table.ownerType, table.ownerId),
    index("Subscription_stripeCustomerId_idx").on(table.stripeCustomerId),
  ],
);

/**
 * Stripe delivers a webhook more than once when it does not see a timely 2xx,
 * so event ids are remembered and replays are acknowledged without redoing
 * the work.
 */
export const stripeEvents = pgTable("stripeEvent", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
