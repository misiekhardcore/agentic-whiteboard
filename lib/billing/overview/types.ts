import type { TeamOption } from "@/lib/organizations/contracts";

import { type Entitlements } from "../entitlements";
import { type UpgradeReason } from "../plans";
import { type AccountUsage, type ReachedLimit } from "../usage";

export type BillingOverview = {
  userId: string;
  userName: string;
  /** The active account: an organization id, or `null` for the personal one. */
  organizationId: string | null;
  accountName: string;
  canManageBilling: boolean;
  teams: TeamOption[];
  defaultOrganizationId: string | null;
  entitlements: Entitlements;
  usage: AccountUsage;
  reached: ReachedLimit[];
  reasons: UpgradeReason[];
};
