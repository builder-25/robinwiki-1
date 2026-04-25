-- Embedding retry bookkeeping (issue #151). Fragments that fail embedding
-- at ingest time previously sat with embedding=NULL forever. The retry
-- scheduler scans these two columns to choose the next batch and bumps
-- the attempt count on each attempt.
--
-- Partial index on `embedding_last_attempt_at WHERE embedding IS NULL AND
-- deleted_at IS NULL` keeps the retry scan O(unembedded) regardless of
-- total fragment count.
ALTER TABLE "fragments" ADD COLUMN "embedding_attempt_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "fragments" ADD COLUMN "embedding_last_attempt_at" timestamp;--> statement-breakpoint
CREATE INDEX "fragments_embedding_null_idx"
  ON "fragments" ("embedding_last_attempt_at")
  WHERE "embedding" IS NULL AND "deleted_at" IS NULL;
