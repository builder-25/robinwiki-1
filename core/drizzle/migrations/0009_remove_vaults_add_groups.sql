-- Remove vaultId FK columns from domain tables
ALTER TABLE "raw_sources" DROP COLUMN IF EXISTS "vault_id";
ALTER TABLE "fragments" DROP COLUMN IF EXISTS "vault_id";
ALTER TABLE "wikis" DROP COLUMN IF EXISTS "vault_id";

-- Drop vaults table
DROP TABLE IF EXISTS "vaults";

-- Add groups table
CREATE TABLE IF NOT EXISTS "groups" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "icon" text NOT NULL DEFAULT '',
  "color" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "groups_slug_uidx" ON "groups" ("slug");

-- Add group_wikis junction table
CREATE TABLE IF NOT EXISTS "group_wikis" (
  "group_id" text NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "wiki_id" text NOT NULL REFERENCES "wikis"("lookup_key") ON DELETE CASCADE,
  "added_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("group_id", "wiki_id")
);

CREATE INDEX "group_wikis_wiki_idx" ON "group_wikis" ("wiki_id");
