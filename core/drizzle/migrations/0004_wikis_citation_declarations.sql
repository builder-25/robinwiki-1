-- Sidecar (m-wiki-sidecar): add JSONB `citation_declarations` column to `wikis`.
-- Stores the per-section citation declarations the wiki-generation LLM emits
-- alongside its markdown. Read-side attaches these to resolved section objects
-- via buildSidecar (see core/src/lib/wikiSidecar.ts). Default [] keeps older
-- rows consistent with the "no citations yet" state.
ALTER TABLE "wikis" ADD COLUMN "citation_declarations" jsonb NOT NULL DEFAULT '[]'::jsonb;
