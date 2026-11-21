DROP INDEX "AgentConversation_userId_account_updatedAt_idx";--> statement-breakpoint
DROP INDEX "AgentPrompt_ownerId_userId_createdAt_idx";--> statement-breakpoint
ALTER TABLE "agentConversation" ADD COLUMN "organizationId" text;--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD COLUMN "organizationId" text;--> statement-breakpoint
-- The account used to be stored as a kind plus an id: the organization's id for
-- an organization's row, the person's own id otherwise. Keep the first and turn
-- the second into the null a personal account now is, so nothing moves between
-- accounts and no history is rewritten.
UPDATE "agentConversation"
SET "organizationId" = "accountId"
WHERE "accountType" = 'ORGANIZATION';--> statement-breakpoint
UPDATE "agentPrompt"
SET "organizationId" = CASE WHEN "ownerId" = "userId" THEN NULL ELSE "ownerId" END;--> statement-breakpoint
CREATE INDEX "AgentConversation_userId_organization_updatedAt_idx" ON "agentConversation" USING btree ("userId","organizationId","updatedAt");--> statement-breakpoint
CREATE INDEX "AgentPrompt_organizationId_userId_createdAt_idx" ON "agentPrompt" USING btree ("organizationId","userId","createdAt");
