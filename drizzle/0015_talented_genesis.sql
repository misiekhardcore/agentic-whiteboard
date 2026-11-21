CREATE TYPE "public"."ConversationAccountType" AS ENUM('PERSONAL', 'ORGANIZATION');--> statement-breakpoint
DROP INDEX "AgentConversation_userId_updatedAt_idx";--> statement-breakpoint
ALTER TABLE "agentConversation" ADD COLUMN "accountType" "ConversationAccountType";--> statement-breakpoint
ALTER TABLE "agentConversation" ADD COLUMN "accountId" text;--> statement-breakpoint
-- Conversations predate accounts, and every one of them was written by its
-- owner acting alone: file each in that person's own account instead of
-- inventing an organization. Nothing moves between accounts, so a person who
-- signs in after the deploy finds their history where they left it.
UPDATE "agentConversation"
SET "accountType" = 'PERSONAL', "accountId" = "userId";--> statement-breakpoint
ALTER TABLE "agentConversation" ALTER COLUMN "accountType" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agentConversation" ALTER COLUMN "accountId" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "AgentConversation_userId_account_updatedAt_idx" ON "agentConversation" USING btree ("userId","accountType","accountId","updatedAt");
