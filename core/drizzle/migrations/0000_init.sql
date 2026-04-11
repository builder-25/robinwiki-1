CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."object_state" AS ENUM('PENDING', 'RESOLVED', 'LINKING', 'DIRTY');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"operation" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configs" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configs_scope_check" CHECK (("configs"."scope" = 'system' AND "configs"."user_id" IS NULL) OR ("configs"."scope" = 'user' AND "configs"."user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"src_type" text NOT NULL,
	"src_id" text NOT NULL,
	"dst_type" text NOT NULL,
	"dst_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"attrs" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edits" (
	"id" text PRIMARY KEY NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"user_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"type" text DEFAULT 'addition' NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_sources" (
	"lookup_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"state" "object_state" DEFAULT 'PENDING' NOT NULL,
	"repo_path" text DEFAULT '' NOT NULL,
	"frontmatter_hash" text,
	"body_hash" text,
	"content_hash" text,
	"dedup_hash" text,
	"locked_by" text,
	"locked_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'thought' NOT NULL,
	"source" text DEFAULT 'api' NOT NULL,
	"vault_id" text
);
--> statement-breakpoint
CREATE TABLE "fragments" (
	"lookup_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"state" "object_state" DEFAULT 'PENDING' NOT NULL,
	"repo_path" text DEFAULT '' NOT NULL,
	"frontmatter_hash" text,
	"body_hash" text,
	"content_hash" text,
	"dedup_hash" text,
	"locked_by" text,
	"locked_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"type" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entry_id" text,
	"vault_id" text,
	"embedding" vector(1536),
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "people" (
	"lookup_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"state" "object_state" DEFAULT 'PENDING' NOT NULL,
	"repo_path" text DEFAULT '' NOT NULL,
	"frontmatter_hash" text,
	"body_hash" text,
	"content_hash" text,
	"dedup_hash" text,
	"locked_by" text,
	"locked_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"relationship" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_rebuilt_at" timestamp,
	"embedding" vector(1536),
	"search_vector" "tsvector"
);
--> statement-breakpoint
CREATE TABLE "pipeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_key" text NOT NULL,
	"job_id" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"fragment_key" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"content_hash" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"public_key" text DEFAULT '' NOT NULL,
	"encrypted_private_key" text DEFAULT '' NOT NULL,
	"mcp_token_version" integer DEFAULT 1 NOT NULL,
	"encrypted_dek" text DEFAULT '' NOT NULL,
	"password_reset_required" boolean DEFAULT false NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wikis" (
	"lookup_key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"state" "object_state" DEFAULT 'PENDING' NOT NULL,
	"repo_path" text DEFAULT '' NOT NULL,
	"frontmatter_hash" text,
	"body_hash" text,
	"content_hash" text,
	"dedup_hash" text,
	"locked_by" text,
	"locked_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'log' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"vault_id" text,
	"last_rebuilt_at" timestamp,
	"embedding" vector(1536),
	"search_vector" "tsvector"
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configs" ADD CONSTRAINT "configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edits" ADD CONSTRAINT "edits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_sources" ADD CONSTRAINT "raw_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_sources" ADD CONSTRAINT "raw_sources_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_entry_id_raw_sources_lookup_key_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."raw_sources"("lookup_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikis" ADD CONSTRAINT "wikis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wikis" ADD CONSTRAINT "wikis_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "configs_scope_user_kind_key_uidx" ON "configs" USING btree ("scope","user_id","kind","key");--> statement-breakpoint
CREATE INDEX "configs_user_kind_idx" ON "configs" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "edges_src_dst_type_uidx" ON "edges" USING btree ("src_type","src_id","dst_type","dst_id","edge_type");--> statement-breakpoint
CREATE INDEX "edges_user_src_idx" ON "edges" USING btree ("user_id","src_type","src_id","edge_type");--> statement-breakpoint
CREATE INDEX "edges_user_dst_idx" ON "edges" USING btree ("user_id","dst_type","dst_id","edge_type");--> statement-breakpoint
CREATE INDEX "edits_object_idx" ON "edits" USING btree ("object_type","object_id");--> statement-breakpoint
CREATE INDEX "raw_sources_user_idx" ON "raw_sources" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_sources_user_slug_uidx" ON "raw_sources" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "fragments_user_idx" ON "fragments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fragments_user_slug_uidx" ON "fragments" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "people_user_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_user_slug_uidx" ON "people" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "pipeline_events_entry_key_idx" ON "pipeline_events" USING btree ("entry_key");--> statement-breakpoint
CREATE INDEX "pipeline_events_status_stage_idx" ON "pipeline_events" USING btree ("status","stage");--> statement-breakpoint
CREATE INDEX "pipeline_events_created_at_idx" ON "pipeline_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "processed_jobs_content_hash_idx" ON "processed_jobs" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "processed_jobs_processed_at_idx" ON "processed_jobs" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "vaults_user_idx" ON "vaults" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wikis_user_idx" ON "wikis" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wikis_user_slug_uidx" ON "wikis" USING btree ("user_id","slug");--> statement-breakpoint

-- ─── HNSW indexes on embedding columns (cosine distance) ───
CREATE INDEX "wikis_embedding_hnsw_idx" ON "wikis" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);--> statement-breakpoint
CREATE INDEX "fragments_embedding_hnsw_idx" ON "fragments" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);--> statement-breakpoint
CREATE INDEX "people_embedding_hnsw_idx" ON "people" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);--> statement-breakpoint

-- ─── tsvector search_vector triggers and GIN indexes ───
-- Wikis: name (A) + prompt (B)
CREATE OR REPLACE FUNCTION wikis_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.prompt, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER wikis_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, prompt ON "wikis"
  FOR EACH ROW EXECUTE FUNCTION wikis_search_vector_update();--> statement-breakpoint

CREATE INDEX "wikis_search_vector_gin_idx" ON "wikis" USING gin ("search_vector");--> statement-breakpoint

-- Fragments: title (A)
CREATE OR REPLACE FUNCTION fragments_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER fragments_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title ON "fragments"
  FOR EACH ROW EXECUTE FUNCTION fragments_search_vector_update();--> statement-breakpoint

CREATE INDEX "fragments_search_vector_gin_idx" ON "fragments" USING gin ("search_vector");--> statement-breakpoint

-- People: name (A) + relationship (B)
CREATE OR REPLACE FUNCTION people_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.relationship, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER people_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, relationship ON "people"
  FOR EACH ROW EXECUTE FUNCTION people_search_vector_update();--> statement-breakpoint

CREATE INDEX "people_search_vector_gin_idx" ON "people" USING gin ("search_vector");