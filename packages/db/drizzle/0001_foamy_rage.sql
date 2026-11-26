CREATE TABLE "doc_room" (
	"room_id" text PRIMARY KEY NOT NULL,
	"yjs_state" "bytea",
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_room_lease" (
	"room_id" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "doc_room_lease_expires_at_idx" ON "doc_room_lease" USING btree ("expires_at");