import { user } from "@/lib/db/schema";

/**
 * The creator's joined columns. Every read that feeds a workspace card selects
 * these beside the workspace's own, so the join is written once and
 * `withCreator` reads the same two names back.
 */
export const creatorColumns = {
  creatorName: user.name,
  creatorImage: user.image,
} as const;
