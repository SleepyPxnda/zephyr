CREATE TYPE "public"."file_kind" AS ENUM('audio', 'image');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('viewer', 'editor');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "arena" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"image_id" uuid,
	"width_m" numeric NOT NULL,
	"length_m" numeric NOT NULL,
	"placeholder" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arena_single_row" CHECK ("arena"."id" = 1),
	CONSTRAINT "arena_size" CHECK ("arena"."width_m" > 0 and "arena"."length_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "file_kind" NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text DEFAULT '' NOT NULL,
	"duration_s" numeric,
	"peaks" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "files_size" CHECK ("files"."bytes" >= 0 and (("files"."kind" = 'audio' and "files"."bytes" <= 52428800) or ("files"."kind" = 'image' and "files"."bytes" <= 15728640)))
);
--> statement-breakpoint
CREATE TABLE "gaits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"color" char(7) NOT NULL,
	"speed_tack" numeric NOT NULL,
	"speed_bare" numeric NOT NULL,
	"turn_diameter_m" numeric NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "gaits_speed" CHECK ("gaits"."speed_tack" > 0 and "gaits"."speed_tack" <= 20 and "gaits"."speed_bare" > 0 and "gaits"."speed_bare" <= 20),
	CONSTRAINT "gaits_diameter" CHECK ("gaits"."turn_diameter_m" >= 0),
	CONSTRAINT "gaits_color" CHECK ("gaits"."color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "horses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"number" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"color" char(7) NOT NULL,
	"tack" boolean DEFAULT true NOT NULL,
	"path" jsonb NOT NULL,
	"pending" jsonb
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"start_s" numeric NOT NULL,
	"end_s" numeric NOT NULL,
	"color" char(7) NOT NULL,
	CONSTRAINT "parts_range" CHECK ("parts"."end_s" > "parts"."start_s" and "parts"."start_s" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plan_members" (
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	CONSTRAINT "plan_members_plan_id_user_id_pk" PRIMARY KEY("plan_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"label" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"music_id" uuid,
	"bpm" numeric,
	"beat0_s" numeric DEFAULT 0 NOT NULL,
	"meter" smallint DEFAULT 4 NOT NULL,
	"settings" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plans_meter" CHECK ("plans"."meter" in (3, 4)),
	CONSTRAINT "plans_bpm" CHECK ("plans"."bpm" is null or ("plans"."bpm" >= 1 and "plans"."bpm" <= 260)),
	CONSTRAINT "plans_beat0" CHECK ("plans"."beat0_s" >= 0)
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "member_role" DEFAULT 'viewer' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token"),
	CONSTRAINT "share_links_viewer" CHECK ("share_links"."role" = 'viewer')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "arena" ADD CONSTRAINT "arena_image_id_files_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horses" ADD CONSTRAINT "horses_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_members" ADD CONSTRAINT "plan_members_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_members" ADD CONSTRAINT "plan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_music_id_files_id_fk" FOREIGN KEY ("music_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "horses_plan_idx" ON "horses" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "parts_plan_idx" ON "parts" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_members_user_idx" ON "plan_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plan_versions_plan_idx" ON "plan_versions" USING btree ("plan_id","revision");--> statement-breakpoint
CREATE INDEX "plans_owner_idx" ON "plans" USING btree ("owner_id");