CREATE TYPE "public"."AgentActorType" AS ENUM('USER', 'AGENT');--> statement-breakpoint
CREATE TYPE "public"."AgentMessageRole" AS ENUM('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');--> statement-breakpoint
CREATE TYPE "public"."AgentRunStatus" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "agentMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"runId" text NOT NULL,
	"role" "AgentMessageRole" NOT NULL,
	"content" jsonb NOT NULL,
	"actorType" "AgentActorType" NOT NULL,
	"userId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentRun" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"orgId" text,
	"requestedByUserId" text NOT NULL,
	"status" "AgentRunStatus" DEFAULT 'QUEUED' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"usage" jsonb,
	"error" text,
	"startedAt" timestamp (3),
	"finishedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agentMessage" ADD CONSTRAINT "agentMessage_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentMessage" ADD CONSTRAINT "agentMessage_runId_agentRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."agentRun"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentMessage" ADD CONSTRAINT "agentMessage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentRun" ADD CONSTRAINT "agentRun_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agentRun" ADD CONSTRAINT "agentRun_requestedByUserId_user_id_fk" FOREIGN KEY ("requestedByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentMessage_workspaceId_createdAt_idx" ON "agentMessage" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "AgentMessage_runId_idx" ON "agentMessage" USING btree ("runId");--> statement-breakpoint
CREATE INDEX "AgentRun_workspaceId_createdAt_idx" ON "agentRun" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "AgentRun_requestedByUserId_createdAt_idx" ON "agentRun" USING btree ("requestedByUserId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "AgentRun_one_active_per_workspace_idx" ON "agentRun" USING btree ("workspaceId") WHERE "agentRun"."status" in ('QUEUED', 'RUNNING');