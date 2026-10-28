import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_webhook_events_rebuild" AS ENUM('requested', 'failed', 'skipped');
  CREATE TABLE "webhook_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"topic" varchar NOT NULL,
  	"summary" varchar,
  	"rebuild" "enum_webhook_events_rebuild" NOT NULL,
  	"webhook_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "webhook_events_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "webhook_events_id" integer;
  ALTER TABLE "webhook_events_rels" ADD CONSTRAINT "webhook_events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "webhook_events_rels" ADD CONSTRAINT "webhook_events_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "webhook_events_webhook_id_idx" ON "webhook_events" USING btree ("webhook_id");
  CREATE INDEX "webhook_events_updated_at_idx" ON "webhook_events" USING btree ("updated_at");
  CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");
  CREATE INDEX "webhook_events_rels_order_idx" ON "webhook_events_rels" USING btree ("order");
  CREATE INDEX "webhook_events_rels_parent_idx" ON "webhook_events_rels" USING btree ("parent_id");
  CREATE INDEX "webhook_events_rels_path_idx" ON "webhook_events_rels" USING btree ("path");
  CREATE INDEX "webhook_events_rels_users_id_idx" ON "webhook_events_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_events_fk" FOREIGN KEY ("webhook_events_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "webhook_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "webhook_events_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "webhook_events" CASCADE;
  DROP TABLE "webhook_events_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_webhook_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_webhook_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "webhook_events_id";
  DROP TYPE "public"."enum_webhook_events_rebuild";`)
}
