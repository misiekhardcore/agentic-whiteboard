ALTER TABLE "subscription" ADD COLUMN "billingInterval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "startedAt" timestamp (3);