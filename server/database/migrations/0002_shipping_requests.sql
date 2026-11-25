CREATE TYPE "public"."shipping_status" AS ENUM('pending', 'shipped', 'cancelled');--> statement-breakpoint
CREATE TABLE "shipping_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"store_name" text NOT NULL,
	"store_code" text,
	"note" text,
	"item_total_cents" integer NOT NULL,
	"deposit_paid_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"cod_cents" integer NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "shipping_status" DEFAULT 'pending' NOT NULL,
	"shipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "shipping_request_id" uuid;--> statement-breakpoint
ALTER TABLE "shipping_requests" ADD CONSTRAINT "shipping_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_requests_user_created_idx" ON "shipping_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "shipping_requests_status_idx" ON "shipping_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_requests_one_pending_per_user_idx" ON "shipping_requests" USING btree ("user_id") WHERE status = 'pending';--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_shipping_request_id_shipping_requests_id_fk" FOREIGN KEY ("shipping_request_id") REFERENCES "public"."shipping_requests"("id") ON DELETE set null ON UPDATE no action;