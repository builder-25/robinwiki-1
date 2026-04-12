ALTER TABLE "wikis"
  ADD COLUMN "published" boolean NOT NULL DEFAULT false,
  ADD COLUMN "published_slug" text,
  ADD COLUMN "published_at" timestamp,
  ADD COLUMN "regenerate" boolean NOT NULL DEFAULT true;--> statement-breakpoint

CREATE UNIQUE INDEX "wikis_published_slug_uidx" ON "wikis" ("published_slug")
  WHERE "published_slug" IS NOT NULL;
