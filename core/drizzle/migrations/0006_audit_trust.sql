-- M9: Audit log schema migration
-- Restructure audit_log from unstructured operation/metadata to structured event columns.
-- M10 will extend this same migration file with trust columns later.

ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_user_id_users_id_fk";
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "operation";
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "metadata";

ALTER TABLE "audit_log" ADD COLUMN "entity_type" text NOT NULL DEFAULT '';
ALTER TABLE "audit_log" ADD COLUMN "entity_id" text NOT NULL DEFAULT '';
ALTER TABLE "audit_log" ADD COLUMN "event_type" text NOT NULL DEFAULT '';
ALTER TABLE "audit_log" ADD COLUMN "source" text;
ALTER TABLE "audit_log" ADD COLUMN "summary" text NOT NULL DEFAULT '';
ALTER TABLE "audit_log" ADD COLUMN "detail" jsonb;

CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("entity_type", "entity_id");
CREATE INDEX "audit_log_event_type_idx" ON "audit_log" ("event_type");
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" ("created_at" DESC);
