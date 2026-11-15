CREATE TABLE "userSettings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"read_aloud" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "userSettings" ADD CONSTRAINT "userSettings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;