import { relations } from "drizzle-orm";

import { invitation } from "./invitation";
import { member } from "./member";
import { organization } from "./organization";

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));
