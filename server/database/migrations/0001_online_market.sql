CREATE TYPE "public"."market_order_status" AS ENUM('pending_deposit', 'payment_submitted', 'deposit_confirmed', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."market_product_status" AS ENUM('available', 'reserved', 'sold');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('draft', 'upcoming', 'live', 'ended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'notified', 'converted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"product_image_snapshot" text,
	"status" "market_order_status" DEFAULT 'pending_deposit' NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"deposit_cents" integer NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"story" text,
	"purchase_notes" text,
	"status" "market_product_status" DEFAULT 'available' NOT NULL,
	"allow_waitlist_when_sold" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "market_status" DEFAULT 'draft' NOT NULL,
	"deposit_due_hours" integer DEFAULT 48 NOT NULL,
	"waitlist_window_hours" integer DEFAULT 24 NOT NULL,
	"allow_waitlist_when_sold" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"bank_last5" text NOT NULL,
	"paid_amount_cents" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"notified_at" timestamp with time zone,
	"window_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_product_id_market_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."market_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_products" ADD CONSTRAINT "market_products_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_follows" ADD CONSTRAINT "product_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_follows" ADD CONSTRAINT "product_follows_product_id_market_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."market_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_product_id_market_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."market_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "market_orders_one_active_per_product_idx" ON "market_orders" USING btree ("product_id") WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "market_orders_user_created_idx" ON "market_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "market_orders_status_idx" ON "market_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "market_products_market_id_sort_idx" ON "market_products" USING btree ("market_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "market_products_market_code_idx" ON "market_products" USING btree ("market_id","code");--> statement-breakpoint
CREATE INDEX "markets_status_starts_at_idx" ON "markets" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "payment_submissions_order_id_idx" ON "payment_submissions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_follows_user_product_idx" ON "product_follows" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "product_follows_product_id_idx" ON "product_follows" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_active_user_product_idx" ON "waitlist_entries" USING btree ("user_id","product_id") WHERE status in ('waiting', 'notified');--> statement-breakpoint
CREATE INDEX "waitlist_entries_product_created_idx" ON "waitlist_entries" USING btree ("product_id","created_at");