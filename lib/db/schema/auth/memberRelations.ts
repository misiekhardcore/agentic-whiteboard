import { relations } from "drizzle-orm";

import { member } from "./member";
import { organization } from "./organization";
import { user } from "./user";

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));
