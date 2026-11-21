import { pgEnum } from "drizzle-orm/pg-core";

import { CONVERSATION_ACCOUNT_TYPES } from "../../../collab/contracts";

export const conversationAccountTypeEnum = pgEnum(
  "ConversationAccountType",
  CONVERSATION_ACCOUNT_TYPES,
);
