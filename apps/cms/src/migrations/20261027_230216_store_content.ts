import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_blocks_media_text_image_position" AS ENUM('right', 'left');
  CREATE TYPE "public"."enum_products_locale" AS ENUM('fr', 'en');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_v_blocks_media_text_image_position" AS ENUM('right', 'left');
  CREATE TYPE "public"."enum__products_v_version_locale" AS ENUM('fr', 'en');
  CREATE TYPE "public"."enum__products_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_locale" AS ENUM('fr', 'en');
  CREATE TABLE "pages_blocks_collection_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"handle" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "pages_blocks_collection_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_collection_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"handle" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_collection_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "products_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rich_text" jsonb,
  	"html" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "products_blocks_media_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"rich_text" jsonb,
  	"html" varchar,
  	"image_id" integer,
  	"image_position" "enum_products_blocks_media_text_image_position" DEFAULT 'right',
  	"block_name" varchar
  );
  
  CREATE TABLE "products_blocks_feature_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar
  );
  
  CREATE TABLE "products_blocks_feature_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"intro" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "products_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"domain_id" integer,
  	"locale" "enum_products_locale" DEFAULT 'fr',
  	"slug" varchar,
  	"translation_of_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_products_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "_products_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"rich_text" jsonb,
  	"html" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_products_v_blocks_media_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"rich_text" jsonb,
  	"html" varchar,
  	"image_id" integer,
  	"image_position" "enum__products_v_blocks_media_text_image_position" DEFAULT 'right',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_products_v_blocks_feature_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_blocks_feature_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"intro" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_products_v_version_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"version_domain_id" integer,
  	"version_locale" "enum__products_v_version_locale" DEFAULT 'fr',
  	"version_slug" varchar,
  	"version_translation_of_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__products_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "site_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_footer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL
  );
  
  CREATE TABLE "site" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"domain_id" integer NOT NULL,
  	"locale" "enum_site_locale" DEFAULT 'fr' NOT NULL,
  	"footer_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_id" integer;
  ALTER TABLE "pages_blocks_collection_list_items" ADD CONSTRAINT "pages_blocks_collection_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_collection_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_collection_list" ADD CONSTRAINT "pages_blocks_collection_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_collection_list_items" ADD CONSTRAINT "_pages_v_blocks_collection_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_collection_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_collection_list" ADD CONSTRAINT "_pages_v_blocks_collection_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_blocks_rich_text" ADD CONSTRAINT "products_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_blocks_media_text" ADD CONSTRAINT "products_blocks_media_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_blocks_media_text" ADD CONSTRAINT "products_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_blocks_feature_list_items" ADD CONSTRAINT "products_blocks_feature_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_blocks_feature_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_blocks_feature_list" ADD CONSTRAINT "products_blocks_feature_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_badges" ADD CONSTRAINT "products_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_translation_of_id_products_id_fk" FOREIGN KEY ("translation_of_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_rich_text" ADD CONSTRAINT "_products_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_media_text" ADD CONSTRAINT "_products_v_blocks_media_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_media_text" ADD CONSTRAINT "_products_v_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_feature_list_items" ADD CONSTRAINT "_products_v_blocks_feature_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v_blocks_feature_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_feature_list" ADD CONSTRAINT "_products_v_blocks_feature_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_badges" ADD CONSTRAINT "_products_v_version_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_domain_id_domains_id_fk" FOREIGN KEY ("version_domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_translation_of_id_products_id_fk" FOREIGN KEY ("version_translation_of_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_nav" ADD CONSTRAINT "site_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_footer_links" ADD CONSTRAINT "site_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_footer" ADD CONSTRAINT "site_footer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site" ADD CONSTRAINT "site_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_collection_list_items_order_idx" ON "pages_blocks_collection_list_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_collection_list_items_parent_id_idx" ON "pages_blocks_collection_list_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_collection_list_order_idx" ON "pages_blocks_collection_list" USING btree ("_order");
  CREATE INDEX "pages_blocks_collection_list_parent_id_idx" ON "pages_blocks_collection_list" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_collection_list_path_idx" ON "pages_blocks_collection_list" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_collection_list_items_order_idx" ON "_pages_v_blocks_collection_list_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_collection_list_items_parent_id_idx" ON "_pages_v_blocks_collection_list_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_collection_list_order_idx" ON "_pages_v_blocks_collection_list" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_collection_list_parent_id_idx" ON "_pages_v_blocks_collection_list" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_collection_list_path_idx" ON "_pages_v_blocks_collection_list" USING btree ("_path");
  CREATE INDEX "products_blocks_rich_text_order_idx" ON "products_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "products_blocks_rich_text_parent_id_idx" ON "products_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_rich_text_path_idx" ON "products_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "products_blocks_media_text_order_idx" ON "products_blocks_media_text" USING btree ("_order");
  CREATE INDEX "products_blocks_media_text_parent_id_idx" ON "products_blocks_media_text" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_media_text_path_idx" ON "products_blocks_media_text" USING btree ("_path");
  CREATE INDEX "products_blocks_media_text_image_idx" ON "products_blocks_media_text" USING btree ("image_id");
  CREATE INDEX "products_blocks_feature_list_items_order_idx" ON "products_blocks_feature_list_items" USING btree ("_order");
  CREATE INDEX "products_blocks_feature_list_items_parent_id_idx" ON "products_blocks_feature_list_items" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_feature_list_order_idx" ON "products_blocks_feature_list" USING btree ("_order");
  CREATE INDEX "products_blocks_feature_list_parent_id_idx" ON "products_blocks_feature_list" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_feature_list_path_idx" ON "products_blocks_feature_list" USING btree ("_path");
  CREATE INDEX "products_badges_order_idx" ON "products_badges" USING btree ("_order");
  CREATE INDEX "products_badges_parent_id_idx" ON "products_badges" USING btree ("_parent_id");
  CREATE INDEX "products_meta_meta_image_idx" ON "products" USING btree ("meta_image_id");
  CREATE INDEX "products_domain_idx" ON "products" USING btree ("domain_id");
  CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_translation_of_idx" ON "products" USING btree ("translation_of_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products__status_idx" ON "products" USING btree ("_status");
  CREATE UNIQUE INDEX "domain_locale_slug_3_idx" ON "products" USING btree ("domain_id","locale","slug");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_users_id_idx" ON "products_rels" USING btree ("users_id");
  CREATE INDEX "_products_v_blocks_rich_text_order_idx" ON "_products_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_rich_text_parent_id_idx" ON "_products_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_rich_text_path_idx" ON "_products_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "_products_v_blocks_media_text_order_idx" ON "_products_v_blocks_media_text" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_media_text_parent_id_idx" ON "_products_v_blocks_media_text" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_media_text_path_idx" ON "_products_v_blocks_media_text" USING btree ("_path");
  CREATE INDEX "_products_v_blocks_media_text_image_idx" ON "_products_v_blocks_media_text" USING btree ("image_id");
  CREATE INDEX "_products_v_blocks_feature_list_items_order_idx" ON "_products_v_blocks_feature_list_items" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_feature_list_items_parent_id_idx" ON "_products_v_blocks_feature_list_items" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_feature_list_order_idx" ON "_products_v_blocks_feature_list" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_feature_list_parent_id_idx" ON "_products_v_blocks_feature_list" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_feature_list_path_idx" ON "_products_v_blocks_feature_list" USING btree ("_path");
  CREATE INDEX "_products_v_version_badges_order_idx" ON "_products_v_version_badges" USING btree ("_order");
  CREATE INDEX "_products_v_version_badges_parent_id_idx" ON "_products_v_version_badges" USING btree ("_parent_id");
  CREATE INDEX "_products_v_parent_idx" ON "_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_meta_version_meta_image_idx" ON "_products_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_products_v_version_version_domain_idx" ON "_products_v" USING btree ("version_domain_id");
  CREATE INDEX "_products_v_version_version_slug_idx" ON "_products_v" USING btree ("version_slug");
  CREATE INDEX "_products_v_version_version_translation_of_idx" ON "_products_v" USING btree ("version_translation_of_id");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_version_version__status_idx" ON "_products_v" USING btree ("version__status");
  CREATE INDEX "_products_v_created_at_idx" ON "_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_latest_idx" ON "_products_v" USING btree ("latest");
  CREATE INDEX "_products_v_autosave_idx" ON "_products_v" USING btree ("autosave");
  CREATE INDEX "version_domain_version_locale_version_slug_3_idx" ON "_products_v" USING btree ("version_domain_id","version_locale","version_slug");
  CREATE INDEX "_products_v_rels_order_idx" ON "_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_users_id_idx" ON "_products_v_rels" USING btree ("users_id");
  CREATE INDEX "site_nav_order_idx" ON "site_nav" USING btree ("_order");
  CREATE INDEX "site_nav_parent_id_idx" ON "site_nav" USING btree ("_parent_id");
  CREATE INDEX "site_footer_links_order_idx" ON "site_footer_links" USING btree ("_order");
  CREATE INDEX "site_footer_links_parent_id_idx" ON "site_footer_links" USING btree ("_parent_id");
  CREATE INDEX "site_footer_order_idx" ON "site_footer" USING btree ("_order");
  CREATE INDEX "site_footer_parent_id_idx" ON "site_footer" USING btree ("_parent_id");
  CREATE INDEX "site_domain_idx" ON "site" USING btree ("domain_id");
  CREATE INDEX "site_updated_at_idx" ON "site" USING btree ("updated_at");
  CREATE INDEX "site_created_at_idx" ON "site" USING btree ("created_at");
  CREATE UNIQUE INDEX "domain_locale_idx" ON "site" USING btree ("domain_id","locale");
  CREATE INDEX "site_rels_order_idx" ON "site_rels" USING btree ("order");
  CREATE INDEX "site_rels_parent_idx" ON "site_rels" USING btree ("parent_id");
  CREATE INDEX "site_rels_path_idx" ON "site_rels" USING btree ("path");
  CREATE INDEX "site_rels_users_id_idx" ON "site_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_site_id_idx" ON "payload_locked_documents_rels" USING btree ("site_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_collection_list_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_collection_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_collection_list_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_collection_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_rich_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_media_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_feature_list_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_feature_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_badges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_rich_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_media_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_feature_list_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_feature_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_version_badges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_nav" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_footer_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_footer" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_collection_list_items" CASCADE;
  DROP TABLE "pages_blocks_collection_list" CASCADE;
  DROP TABLE "_pages_v_blocks_collection_list_items" CASCADE;
  DROP TABLE "_pages_v_blocks_collection_list" CASCADE;
  DROP TABLE "products_blocks_rich_text" CASCADE;
  DROP TABLE "products_blocks_media_text" CASCADE;
  DROP TABLE "products_blocks_feature_list_items" CASCADE;
  DROP TABLE "products_blocks_feature_list" CASCADE;
  DROP TABLE "products_badges" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "_products_v_blocks_rich_text" CASCADE;
  DROP TABLE "_products_v_blocks_media_text" CASCADE;
  DROP TABLE "_products_v_blocks_feature_list_items" CASCADE;
  DROP TABLE "_products_v_blocks_feature_list" CASCADE;
  DROP TABLE "_products_v_version_badges" CASCADE;
  DROP TABLE "_products_v" CASCADE;
  DROP TABLE "_products_v_rels" CASCADE;
  DROP TABLE "site_nav" CASCADE;
  DROP TABLE "site_footer_links" CASCADE;
  DROP TABLE "site_footer" CASCADE;
  DROP TABLE "site" CASCADE;
  DROP TABLE "site_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_fk";
  
  DROP INDEX "payload_locked_documents_rels_products_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "products_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_id";
  DROP TYPE "public"."enum_products_blocks_media_text_image_position";
  DROP TYPE "public"."enum_products_locale";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum__products_v_blocks_media_text_image_position";
  DROP TYPE "public"."enum__products_v_version_locale";
  DROP TYPE "public"."enum__products_v_version_status";
  DROP TYPE "public"."enum_site_locale";`)
}
