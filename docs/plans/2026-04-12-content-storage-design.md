# Content Storage Design

**Date:** 2026-04-12
**Status:** Approved
**Scope:** All domain tables (entries, fragments, wikis, people)

## Problem

Wiki body content is written to the `edits` table but never read back. GET endpoints return hardcoded empty strings. The `edits` table is append-only and write-only — a black hole. Fragments and people have the same gap: no canonical content column.

This blocks published wikis, MCP content serving, search indexing of body text, and the regen pipeline's ability to read/write content in one place.

## Decision

Add `content` to `baseColumns()` so all domain tables share a canonical markdown content column. The `edits` table stays as an append-only audit and training log.

## Schema Change

### `baseColumns()` addition

```typescript
function baseColumns() {
  return {
    // ... existing columns ...
    content: text('content').notNull().default(''),
  }
}
```

Remove the explicit `content` column from `entries` — it already has the same type and default, and will now inherit from `baseColumns()`.

### Tables affected

| Table | Before | After |
|-------|--------|-------|
| `entries` (raw_sources) | Has own `content` column | Inherits from `baseColumns()` |
| `fragments` | No content column | Gets `content` from `baseColumns()` |
| `wikis` | No content column | Gets `content` from `baseColumns()` |
| `people` | No content column | Gets `content` from `baseColumns()` |

### Migration

```sql
ALTER TABLE "fragments" ADD COLUMN "content" text NOT NULL DEFAULT '';
ALTER TABLE "wikis" ADD COLUMN "content" text NOT NULL DEFAULT '';
ALTER TABLE "people" ADD COLUMN "content" text NOT NULL DEFAULT '';
```

No change needed for `entries` — column already exists with matching type.

## Write Path

`PUT /api/content/:type/:key` does two things on every write:

1. **Update `{table}.content`** — canonical current state
2. **Insert into `edits`** — audit log entry with source tag (`user`, `mcp`, `regen`)

The regen pipeline also writes to `{table}.content` directly.

## Read Path

All reads come from `{table}.content`. Single row, no joins, no subqueries.

```sql
SELECT name, content FROM wikis WHERE lookup_key = :key
```

## Edits Table

The `edits` table remains append-only. Its purpose is:

- **Audit log** — full history of every content change
- **Training data** — before/after diffs teach the system about user intent
- **Edit timing** — distance between edits signals engagement patterns
- **Source attribution** — `source` tag distinguishes human edits from regen/MCP writes

The `edits` table is never the source of truth for current content. It is a log of how content got to where it is.

### Schema changes to `edits`

Two new columns:

| Column | Type | Purpose |
|--------|------|---------|
| `source` | `text NOT NULL DEFAULT 'user'` | Who made the edit: `user`, `mcp`, `regen` |
| `diff` | `text NOT NULL DEFAULT ''` | Computed diff between previous and new content |

The existing `content` column on `edits` stores the **previous content** (what was there before the edit). The `diff` column stores the computed change. The new/current content is always in `{table}.content`.

### Write path for edits (all types)

On every content update:

1. Read the current `{table}.content` (this is the "before")
2. Update `{table}.content = newBody` (canonical state)
3. Insert into `edits`:
   - `content` = the previous content (from step 1)
   - `diff` = computed diff between previous and new
   - `source` = `'user'` | `'mcp'` | `'regen'`
   - `objectType`, `objectId`, `timestamp` as before

### Migration addition

```sql
ALTER TABLE "edits"
  ADD COLUMN "source" text NOT NULL DEFAULT 'user',
  ADD COLUMN "diff" text NOT NULL DEFAULT '';
```

## tsvector Trigger Updates

Body text becomes full-text searchable. Trigger functions updated to include `content`:

```sql
-- wikis: name (A) + prompt (B) + content (C)
CREATE OR REPLACE FUNCTION wikis_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.prompt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- fragments: title (A) + content (B)
CREATE OR REPLACE FUNCTION fragments_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- people: name (A) + aliases (A) + slug (B) + relationship (B) + content (C)
-- aliases and slug added for find_by_query FTS (m-mcp-person requirement)
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
```

Triggers already exist and fire on INSERT/UPDATE. Replacing the functions updates behavior without re-creating triggers.

## Embedding

No change. Embeddings are application-driven (external API call). The pipeline reads `content` from the same row — no cross-table query needed.

## Frontmatter

No change. Frontmatter fields are already destructured into typed columns on each table (e.g., `wikis.name`, `wikis.type`, `wikis.prompt`). The API contract `{ frontmatter: {...}, body: string }` continues as-is. `body` maps to `{table}.content`.

## Impact on Published Wikis

With `content` on the `wikis` table, the public route reads it directly:

```sql
SELECT name, content, published_at FROM wikis
WHERE published_slug = :nanoid AND published = true
```

No `published_content` column needed. No snapshots, no JSONB, no duplication. The publish endpoint just flips `published = true` and generates the slug.

## Publish columns on `wikis` (simplified)

| Column | Type | Purpose |
|--------|------|---------|
| `published` | boolean, default false | Is this wiki publicly accessible? |
| `published_slug` | text, nullable, unique | nanoid(24), set once on first publish |
| `published_at` | timestamp, nullable | When first published |
| `regenerate` | boolean, default true | Whether regen updates this wiki |

## Execution Order

This is a **prerequisite** for all 4 feature groups. Must land before:
- m-wiki-schema (needs content for wiki type system)
- m-mcp-wiki (needs content for edit_wiki tool)
- m-public-wikis (needs content for public serving)
- m-mcp-person (needs content for person profiles)
