DROP INDEX "AgentConversation_userId_updatedAt_idx";--> statement-breakpoint
DROP INDEX "AgentPrompt_ownerId_userId_createdAt_idx";--> statement-breakpoint
ALTER TABLE "agentConversation" ADD COLUMN "organizationId" text;--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD COLUMN "organizationId" text;--> statement-breakpoint
-- The prompt's old owner was the organization id, or the person's own id when the
-- account was personal. Keep the first as the organization, turn the second into
-- the null a personal account now is, so no history is rewritten or re-attributed.
UPDATE "agentPrompt"
SET "organizationId" = "ownerId"
WHERE "ownerId" <> "userId";--> statement-breakpoint
-- Conversations predate accounts and were written by their owner acting alone,
-- so they were always personal: leaving the new column null files them in that
-- person's own account, and they stay where their owner left them.
ALTER TABLE "agentPrompt" DROP COLUMN "ownerId";--> statement-breakpoint
CREATE INDEX "AgentConversation_userId_organization_updatedAt_idx" ON "agentConversation" USING btree ("userId","organizationId","updatedAt");--> statement-breakpoint
CREATE INDEX "AgentPrompt_organizationId_userId_createdAt_idx" ON "agentPrompt" USING btree ("organizationId","userId","createdAt");
