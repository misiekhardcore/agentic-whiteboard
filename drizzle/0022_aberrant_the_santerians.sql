ALTER TABLE "media" ADD COLUMN "orgId" text;--> statement-breakpoint
CREATE INDEX "Media_orgId_idx" ON "media" USING btree ("orgId");