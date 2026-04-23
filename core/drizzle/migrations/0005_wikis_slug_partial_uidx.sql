-- Make `wikis_slug_uidx` partial on `deleted_at IS NULL` so a soft-deleted
-- wiki no longer blocks re-insertion at the same slug. Previously, seeding
-- the demo fixture after a user soft-deleted it hit a unique-constraint
-- violation because the tombstoned row still held the slug.
--
-- Read-path queries already filter `isNull(deletedAt)`, so restricting the
-- uniqueness predicate to live rows matches the effective invariant.
DROP INDEX "wikis_slug_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "wikis_slug_uidx" ON "wikis" USING btree ("slug") WHERE "wikis"."deleted_at" IS NULL;
