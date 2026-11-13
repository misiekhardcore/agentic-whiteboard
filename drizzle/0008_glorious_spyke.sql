-- One accepted prompt is one record: its input, the execution it started and
-- the row the plan allowance counts. The two tables this replaces (the
-- `agentRun` execution log and the `AgentPrompt` quota ledger) were created
-- ahead of any writer, so they are dropped rather than backfilled.
ALTER TYPE "public"."AgentRunStatus" RENAME TO "AgentPromptStatus";--> statement-breakpoint
DROP TABLE "agentRun" CASCADE;--> statement-breakpoint
DROP TABLE "AgentPrompt" CASCADE;--> statement-breakpoint
DROP TABLE "agentMessage" CASCADE;--> statement-breakpoint
CREATE TABLE "agentPrompt" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text,
	"status" "AgentPromptStatus" DEFAULT 'QUEUED' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"usage" jsonb,
	"error" text,
	"startedAt" timestamp (3),
	"finishedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "agentMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text,
	"promptId" text NOT NULL,
	"role" "AgentMessageRole" NOT NULL,
	"content" jsonb NOT NULL,
	"actorType" "AgentActorType" NOT NULL,
	"userId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD CONSTRAINT "agentPrompt_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentPrompt" ADD CONSTRAINT "agentPrompt_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentMessage" ADD CONSTRAINT "agentMessage_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentMessage" ADD CONSTRAINT "agentMessage_promptId_agentPrompt_id_fk" FOREIGN KEY ("promptId") REFERENCES "public"."agentPrompt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentMessage" ADD CONSTRAINT "agentMessage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentPrompt_ownerId_userId_createdAt_idx" ON "agentPrompt" USING btree ("ownerId","userId","createdAt");--> statement-breakpoint
CREATE INDEX "AgentPrompt_userId_createdAt_idx" ON "agentPrompt" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "AgentPrompt_workspaceId_createdAt_idx" ON "agentPrompt" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "AgentPrompt_one_active_per_workspace_idx" ON "agentPrompt" USING btree ("workspaceId") WHERE "agentPrompt"."status" in ('QUEUED', 'RUNNING');--> statement-breakpoint
CREATE UNIQUE INDEX "AgentPrompt_one_active_per_user_thread_idx" ON "agentPrompt" USING btree ("userId") WHERE "agentPrompt"."workspaceId" is null and "agentPrompt"."status" in ('QUEUED', 'RUNNING');--> statement-breakpoint
CREATE INDEX "AgentMessage_workspaceId_createdAt_idx" ON "agentMessage" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "AgentMessage_promptId_idx" ON "agentMessage" USING btree ("promptId");
