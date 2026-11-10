CREATE TYPE "public"."BillingOwnerType" AS ENUM('USER', 'ORGANIZATION');--> statement-breakpoint
CREATE TABLE "stripeEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerType" "BillingOwnerType" NOT NULL,
	"ownerId" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"stripeCustomerId" text NOT NULL,
	"stripeSubscriptionId" text NOT NULL,
	"stripePriceId" text NOT NULL,
	"currentPeriodStart" timestamp (3),
	"currentPeriodEnd" timestamp (3),
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"canceledAt" timestamp (3),
	"endedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
CREATE INDEX "Subscription_owner_idx" ON "subscription" USING btree ("ownerType","ownerId");--> statement-breakpoint
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "subscription" USING btree ("stripeCustomerId");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_stripe_customer_id_unique" UNIQUE("stripe_customer_id");