CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"uploadedByUserId" text NOT NULL,
	"workspaceId" text,
	"mimeType" text NOT NULL,
	"byteSize" integer NOT NULL,
	"storageKey" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "media_storageKey_unique" UNIQUE("storageKey")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Media_workspaceId_idx" ON "media" USING btree ("workspaceId");