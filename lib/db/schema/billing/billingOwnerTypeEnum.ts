import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Who pays for a subscription. A user buys a personal plan, an organization
 * buys a team plan; `ownerId` points at the matching table's id.
 */
export const billingOwnerTypeEnum = pgEnum("BillingOwnerType", ["USER", "ORGANIZATION"]);
