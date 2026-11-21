CREATE TYPE "public"."WorkspaceActivityActorType" AS ENUM('PERSON', 'AGENT');--> statement-breakpoint
CREATE TYPE "public"."WorkspaceActivityKind" AS ENUM('CREATED', 'RENAMED', 'DESCRIBED', 'STAGE_MOVED', 'ARCHIVED', 'RESTORED', 'DOC_SAVED', 'CANVAS_SAVED');--> statement-breakpoint
CREATE TYPE "public"."WorkspaceActivitySurface" AS ENUM('WORKSPACE', 'DOC', 'CANVAS');--> statement-breakpoint
CREATE TABLE "workspaceActivity" (
	"id" text PRIMARY KEY NOT NULL,
	"workspaceId" text NOT NULL,
	"surface" "WorkspaceActivitySurface" NOT NULL,
	"kind" "WorkspaceActivityKind" NOT NULL,
	"actorType" "WorkspaceActivityActorType" NOT NULL,
	"actorUserId" text NOT NULL,
	"details" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaceActivity" ADD CONSTRAINT "workspaceActivity_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "WorkspaceActivity_workspaceId_createdAt_id_idx" ON "workspaceActivity" USING btree ("workspaceId","createdAt","id");--> statement-breakpoint
-- Every existing workspace gets the one fact its row proves: it was created, at
-- its creation time, by its creator. Earlier edits are not invented, so the
-- backfill stays honest and a history page is never empty.
INSERT INTO "workspaceActivity" ("id", "workspaceId", "surface", "kind", "actorType", "actorUserId", "details", "createdAt")
SELECT 'backfill_' || "id", "id", 'WORKSPACE', 'CREATED', 'PERSON', "creatorId", '{}'::jsonb, "createdAt"
FROM "workspace";