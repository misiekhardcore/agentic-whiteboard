ALTER TABLE "agentConversation" DROP COLUMN "accountType";--> statement-breakpoint
ALTER TABLE "agentConversation" DROP COLUMN "accountId";--> statement-breakpoint
ALTER TABLE "agentPrompt" DROP COLUMN "ownerId";--> statement-breakpoint
DROP TYPE "public"."ConversationAccountType";
