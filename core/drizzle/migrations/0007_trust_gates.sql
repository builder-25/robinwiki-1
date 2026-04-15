ALTER TABLE "fragments" ADD COLUMN "confidence" real;
ALTER TABLE "raw_sources" ADD COLUMN "source_metadata" jsonb;
ALTER TABLE "people" ADD COLUMN "summary" text NOT NULL DEFAULT '';
