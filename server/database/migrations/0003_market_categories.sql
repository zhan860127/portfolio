CREATE TABLE "market_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "market_categories_slug_idx" ON "market_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "market_categories_name_idx" ON "market_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "market_categories_sort_idx" ON "market_categories" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "market_products" ADD CONSTRAINT "market_products_category_id_market_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."market_categories"("id") ON DELETE set null ON UPDATE no action;