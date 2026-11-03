CREATE TYPE "public"."WorkspaceStatus" AS ENUM('PLANNING', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');--> statement-breakpoint
CREATE TABLE "AgentPrompt" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"userId" text NOT NULL,
	"workspaceId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"content" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "canvas_workspaceId_unique" UNIQUE("workspaceId")
);
--> statement-breakpoint
CREATE TABLE "doc" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"content" jsonb,
	"yjsState" "bytea",
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "doc_workspaceId_unique" UNIQUE("workspaceId")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"creatorId" text NOT NULL,
	"clerkOrgId" text,
	"status" "WorkspaceStatus" DEFAULT 'PLANNING' NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"shareToken" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_shareToken_unique" UNIQUE("shareToken")
);
--> statement-breakpoint
ALTER TABLE "AgentPrompt" ADD CONSTRAINT "AgentPrompt_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AgentPrompt" ADD CONSTRAINT "AgentPrompt_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc" ADD CONSTRAINT "doc_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AgentPrompt_ownerId_createdAt_idx" ON "AgentPrompt" USING btree ("ownerId","createdAt");--> statement-breakpoint
CREATE INDEX "Workspace_creatorId_idx" ON "workspace" USING btree ("creatorId");--> statement-breakpoint
CREATE INDEX "Workspace_clerkOrgId_idx" ON "workspace" USING btree ("clerkOrgId");