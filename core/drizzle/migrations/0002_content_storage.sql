-- Content storage: add content column to domain tables, source+diff to edits, update tsvector triggers

ALTER TABLE "fragments" ADD COLUMN "content" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "wikis" ADD COLUMN "content" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "content" text NOT NULL DEFAULT '';--> statement-breakpoint

ALTER TABLE "edits"
  ADD COLUMN "source" text NOT NULL DEFAULT 'user',
  ADD COLUMN "diff" text NOT NULL DEFAULT '';--> statement-breakpoint

-- Updated tsvector triggers to include content

CREATE OR REPLACE FUNCTION wikis_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.prompt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION fragments_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION people_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.aliases, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.slug, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.relationship, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
