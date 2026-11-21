DROP INDEX "WorkspaceActivity_workspaceId_createdAt_id_idx";--> statement-breakpoint
ALTER TABLE "workspaceActivity" ADD COLUMN "sequence" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX "WorkspaceActivity_workspaceId_createdAt_sequence_idx" ON "workspaceActivity" USING btree ("workspaceId","createdAt","sequence");