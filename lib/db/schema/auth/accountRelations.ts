import { relations } from "drizzle-orm";

import { account } from "./account";
import { user } from "./user";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
