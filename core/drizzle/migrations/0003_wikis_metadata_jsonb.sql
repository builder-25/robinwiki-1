-- Sidecar (m-wiki-sidecar): add JSONB `metadata` column to `wikis`.
-- Default NULL; read code treats null equivalently to `{ infobox: null }`.
ALTER TABLE "wikis" ADD COLUMN "metadata" jsonb;
