import { relations } from "drizzle-orm";

import { session } from "./session";
import { user } from "./user";

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));
