-- M2 Ingest Pipeline schema migration
-- 1) Retire DIRTY enum value (PG 16 dance — rename old, create new, recast columns)
-- 2) Drop git-era hash/path columns from baseColumns tables
-- 3) Add ingest audit columns to raw_sources
-- 4) Promote people columns (canonical_name, aliases, verified) and drop sections
-- 5) Single-user collapse — drop user_id from domain tables, rebuild slug uniqueness
-- Auth tables (users/sessions/accounts/verifications) are intentionally left untouched.

-- ─── 1. Retire DIRTY state enum value (PG 16 rename-and-recreate) ───
-- PG cannot auto-cast a column default to a renamed type, so each column drops
-- its default, gets retyped via text, then has the default reapplied.
ALTER TYPE "object_state" RENAME TO "object_state_old";--> statement-breakpoint
CREATE TYPE "object_state" AS ENUM('PENDING', 'LINKING', 'RESOLVED');--> statement-breakpoint
ALTER TABLE "raw_sources" ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "raw_sources" ALTER COLUMN "state" TYPE "object_state" USING "state"::text::"object_state";--> statement-breakpoint
ALTER TABLE "raw_sources" ALTER COLUMN "state" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "fragments"   ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "fragments"   ALTER COLUMN "state" TYPE "object_state" USING "state"::text::"object_state";--> statement-breakpoint
ALTER TABLE "fragments"   ALTER COLUMN "state" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "wikis"       ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "wikis"       ALTER COLUMN "state" TYPE "object_state" USING "state"::text::"object_state";--> statement-breakpoint
ALTER TABLE "wikis"       ALTER COLUMN "state" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "people"      ALTER COLUMN "state" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "people"      ALTER COLUMN "state" TYPE "object_state" USING "state"::text::"object_state";--> statement-breakpoint
ALTER TABLE "people"      ALTER COLUMN "state" SET DEFAULT 'PENDING';--> statement-breakpoint
DROP TYPE "object_state_old";--> statement-breakpoint

-- ─── 2. Drop git-era columns (repo_path, frontmatter_hash, body_hash, content_hash) ───
ALTER TABLE "raw_sources"
  DROP COLUMN IF EXISTS "repo_path",
  DROP COLUMN IF EXISTS "frontmatter_hash",
  DROP COLUMN IF EXISTS "body_hash",
  DROP COLUMN IF EXISTS "content_hash";--> statement-breakpoint
ALTER TABLE "fragments"
  DROP COLUMN IF EXISTS "repo_path",
  DROP COLUMN IF EXISTS "frontmatter_hash",
  DROP COLUMN IF EXISTS "body_hash",
  DROP COLUMN IF EXISTS "content_hash";--> statement-breakpoint
ALTER TABLE "wikis"
  DROP COLUMN IF EXISTS "repo_path",
  DROP COLUMN IF EXISTS "frontmatter_hash",
  DROP COLUMN IF EXISTS "body_hash",
  DROP COLUMN IF EXISTS "content_hash";--> statement-breakpoint
ALTER TABLE "people"
  DROP COLUMN IF EXISTS "repo_path",
  DROP COLUMN IF EXISTS "frontmatter_hash",
  DROP COLUMN IF EXISTS "body_hash",
  DROP COLUMN IF EXISTS "content_hash";--> statement-breakpoint

-- ─── 3. Add ingest audit columns to raw_sources ───
ALTER TABLE "raw_sources"
  ADD COLUMN "ingest_status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN "last_error" text,
  ADD COLUMN "last_attempt_at" timestamp,
  ADD COLUMN "attempt_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE INDEX "raw_sources_ingest_status_idx" ON "raw_sources" ("ingest_status");--> statement-breakpoint

-- ─── 4. Promote people columns; drop sections ───
ALTER TABLE "people"
  ADD COLUMN "canonical_name" text NOT NULL DEFAULT '',
  ADD COLUMN "aliases" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN "verified" boolean NOT NULL DEFAULT false,
  DROP COLUMN IF EXISTS "sections";--> statement-breakpoint
CREATE INDEX "people_aliases_gin_idx" ON "people" USING GIN ("aliases");--> statement-breakpoint

-- ─── 5. Single-user collapse — drop user_id from domain tables ───
-- vaults
DROP INDEX IF EXISTS "vaults_user_idx";--> statement-breakpoint
ALTER TABLE "vaults" DROP CONSTRAINT IF EXISTS "vaults_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "vaults" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- configs
ALTER TABLE "configs" DROP CONSTRAINT IF EXISTS "configs_scope_check";--> statement-breakpoint
DROP INDEX IF EXISTS "configs_scope_user_kind_key_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "configs_user_kind_idx";--> statement-breakpoint
ALTER TABLE "configs" DROP CONSTRAINT IF EXISTS "configs_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "configs" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "configs_scope_kind_key_uidx" ON "configs" ("scope", "kind", "key");--> statement-breakpoint
CREATE INDEX "configs_kind_idx" ON "configs" ("kind");--> statement-breakpoint

-- raw_sources
DROP INDEX IF EXISTS "raw_sources_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "raw_sources_user_slug_uidx";--> statement-breakpoint
ALTER TABLE "raw_sources" DROP CONSTRAINT IF EXISTS "raw_sources_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "raw_sources" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "raw_sources_slug_uidx" ON "raw_sources" ("slug");--> statement-breakpoint

-- fragments
DROP INDEX IF EXISTS "fragments_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "fragments_user_slug_uidx";--> statement-breakpoint
ALTER TABLE "fragments" DROP CONSTRAINT IF EXISTS "fragments_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "fragments" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "fragments_slug_uidx" ON "fragments" ("slug");--> statement-breakpoint

-- wikis
DROP INDEX IF EXISTS "wikis_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "wikis_user_slug_uidx";--> statement-breakpoint
ALTER TABLE "wikis" DROP CONSTRAINT IF EXISTS "wikis_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "wikis" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "wikis_slug_uidx" ON "wikis" ("slug");--> statement-breakpoint

-- people
DROP INDEX IF EXISTS "people_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "people_user_slug_uidx";--> statement-breakpoint
ALTER TABLE "people" DROP CONSTRAINT IF EXISTS "people_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "people_slug_uidx" ON "people" ("slug");--> statement-breakpoint

-- edits
ALTER TABLE "edits" DROP CONSTRAINT IF EXISTS "edits_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "edits" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- edges
DROP INDEX IF EXISTS "edges_user_src_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "edges_user_dst_idx";--> statement-breakpoint
ALTER TABLE "edges" DROP CONSTRAINT IF EXISTS "edges_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "edges" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
CREATE INDEX "edges_src_idx" ON "edges" ("src_type", "src_id", "edge_type");--> statement-breakpoint
CREATE INDEX "edges_dst_idx" ON "edges" ("dst_type", "dst_id", "edge_type");--> statement-breakpoint

-- audit_log
ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- api_keys
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint

-- processed_jobs (no FK existed; just drop column if present)
ALTER TABLE "processed_jobs" DROP COLUMN IF EXISTS "user_id";
