CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"uploadedByUserId" text NOT NULL,
	"orgId" text,
	"mimeType" text NOT NULL,
	"byteSize" integer NOT NULL,
	"storageKey" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "media_storageKey_unique" UNIQUE("storageKey")
);
--> statement-breakpoint
CREATE INDEX "Media_storageKey_idx" ON "media" USING btree ("storageKey");--> statement-breakpoint
CREATE INDEX "Media_orgId_idx" ON "media" USING btree ("orgId");