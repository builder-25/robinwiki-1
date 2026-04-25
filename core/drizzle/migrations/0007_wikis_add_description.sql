-- Catch-up migration for wikis.description (issue #159). The column was
-- added to the drizzle schema in commit 73084fc (PR for #126) but no
-- migration was generated. Every INSERT into wikis has been failing
-- silently since that commit landed on main because drizzle's insert
-- statement lists the column (passing `default`) but the DB doesn't
-- know it.
--
-- Default '' matches the schema declaration (.notNull().default('')).
-- Existing live wikis are unaffected — there are none on any fresh DB.
ALTER TABLE "wikis" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
