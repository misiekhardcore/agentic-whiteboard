CREATE TABLE "agentConversation" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agentMessage" ADD COLUMN "supersededAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD COLUMN "conversationId" text;--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD COLUMN "supersededAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentConversation_userId_updatedAt_idx" ON "agentConversation" USING btree ("userId","updatedAt");--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD CONSTRAINT "agentPrompt_conversationId_agentConversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."agentConversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentPrompt_conversationId_createdAt_idx" ON "agentPrompt" USING btree ("conversationId","createdAt");
--> statement-breakpoint
-- Existing dashboard prompts predate conversations, so give each person one
-- conversation holding the history they already had. This is a backfill, not a
-- repair: the thread they had before the deploy stays exactly one thread.
INSERT INTO "agentConversation" ("id", "userId", "createdAt", "updatedAt")
SELECT 'legacy-' || "userId", "userId", min("createdAt"), max("createdAt")
FROM "agentPrompt"
WHERE "workspaceId" IS NULL AND "conversationId" IS NULL
GROUP BY "userId";--> statement-breakpoint
UPDATE "agentPrompt"
SET "conversationId" = 'legacy-' || "userId"
WHERE "workspaceId" IS NULL AND "conversationId" IS NULL;
