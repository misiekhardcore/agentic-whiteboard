import { relations } from "drizzle-orm";

import { invitation } from "./invitation";
import { organization } from "./organization";
import { user } from "./user";

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));
