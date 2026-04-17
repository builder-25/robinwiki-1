# Robin — Project Summary

A living summary of what Robin is becoming, updated after each phase.

## Where Robin Is Today

**M3-M10 complete (2026-04-16).** Robin is a full knowledge base platform. Capture a thought via MCP or API → the pipeline extracts fragments, finds people, classifies into wikis → Quill regenerates wiki content → hybrid search finds anything → publish wikis to the web with a stable URL. 111/111 UAT asserts passing.

The system ships 15 MCP tools, 61 REST endpoints, hybrid BM25+pgvector search, an append-only audit trail on all 31 write paths, and a Next.js frontend integrated into the monorepo.

**What Robin can do today:**

1. **End-to-end knowledge pipeline.** `POST /entries` → fragment extraction → entity extraction → wiki classification → persist → background regen. 4 LLM-powered stages (vault-classify removed).

2. **15 MCP tools for AI assistants.** list_wikis, create_wiki, edit_wiki, find_person, search, get_wiki_types, create_wiki_type, publish_wiki, unpublish_wiki, delete_wiki, delete_person, brief_person, list_groups, create_group, add_wiki_to_group, get_timeline.

3. **Hybrid search with RRF fusion.** BM25 (tsvector) + semantic (pgvector cosine) across fragments, wikis, and people. Mode selection: hybrid, bm25, vector.

4. **Public wiki publishing.** Stable nanoid24 URLs, JSON + raw markdown, unauthenticated access.

5. **On-demand and background wiki regeneration via Quill.** Type-specific prompts, wiki-to-wiki hyperlinking, customizable document structure, fragment confidence, edit preservation.

6. **Groups for organization.** Loose coupling — wikis exist independently, groups are an optional overlay via junction table.

7. **Audit trail.** Every write path (31 total) emits structured events to audit_log. Wiki-scoped timelines. MCP get_timeline tool.

8. **Trust gates.** Fragment confidence scores, source metadata with citations, people aggregation, wiki spawning with WIKI_RELATED_TO_WIKI edges.

## Phases Completed

| Phase | Name | Shipped | What It Delivered |
|-------|------|---------|-------------------|
| M1 | Foundation | 2026-04-11 | Schema + encryption + single-user auth + hybrid search foundation |
| M2 | Ingest Pipeline | 2026-04-11 | End-to-end ingest, OpenRouter wiring, @robin/caslock, gateway purge |
| M3 | Wiki Composition | 2026-04-12 | 10 wiki types, quality gate, Quill regen, embedding on composition, hyperlinking |
| M4 | Search | 2026-04-13 | Hybrid BM25 + pgvector search with RRF fusion, multi-table |
| M5 | MCP Server | 2026-04-13 | 15 MCP tools, StreamableHTTPServerTransport, all resolvers fixed |
| M6 | API Routes | 2026-04-13 | REST CRUD, bouncer mode, fragment review, progress tracking, wiki history |
| M7 | Frontend Integration | 2026-04-15 | Next.js + shadcn/ui integrated, OpenAPI codegen, React Query hooks, API wiring |
| M9 | Audit Log | 2026-04-15 | Structured audit on 31 write paths, timeline endpoints, MCP tool |
| M10 | Trust Gates | 2026-04-15 | Fragment confidence, source metadata, people aggregation, reader agent, wiki spawn |

**Deferred:** M8 (Deploy & Ship) — plan exists at `docs/plans/m8-deploy.md`

## Active Items

| Item | Severity | Since | Notes |
|------|----------|-------|-------|
| No production deployment | High | M8 deferred | Plan exists. Docker + Railway/Render templates needed. |
| Frontend E2E untested against real backend | High | M7 | API wiring PRs merged but not smoke-tested against running server |
| Vault removal PR (#54) pending merge | Medium | M10 | Groups successor built, validation passed 19/21, fixes committed |
| Stale test fixtures (thread→wiki rename) | Low | M3 | content-write/read tests reference old column names |
| OpenAPI spec may drift again | Low | M6 | Generator script updated but no CI enforcement |
| Reader agent section-level indexing (#26) | Low | Future | Current: truncated content. Future: per-section relevance mapping |
| Recommendation pipeline (#31) | Low | Future | Currently: most recently updated. Future: engagement-based scoring |
| Wiki folders as tag grouping (#45) | Low | Future | Superseded by groups (#53) but tags may still be useful for classification |

## Design Decisions (Cumulative)

| # | Decision | Phase | Why |
|---|----------|-------|-----|
| 1-22 | (See M1/M2 retros) | M1-M2 | Foundation + pipeline decisions |
| 23 | Content lives in `baseColumns()` — one `content` column per domain table | M3 | Single source of truth. Edits table is audit log, not canonical store. |
| 24 | Edits store previous content + diff + source tag (user/mcp/regen) | M3 | Training data for future agent learning. Edit timing signals engagement. |
| 25 | `objective` renamed to `goal` across codebase | M3 | Better fit for personal context. Multi-file rename (6 files). |
| 26 | Wiki prompt overrides replace `[DOCUMENT STRUCTURE]` section via regex | M3 | Preserves Handlebars template while allowing per-wiki customization. |
| 27 | HTTP transport only for MCP (no stdio) | M5 | Compatibility wins. StreamableHTTPServerTransport stateless mode. |
| 28 | RRF fusion for hybrid search (k=60) | M4 | Standard approach. BM25 and vector scores are not directly comparable; RRF normalizes by rank. |
| 29 | Vaults removed, replaced by Groups | M10 | Vaults were foundational coupling. Groups are loose overlay — wikis have no FK to groups. |
| 30 | Group memberships hard-deleted on wiki soft-delete | M10 | FK CASCADE doesn't fire on soft-delete. Explicit cleanup avoids orphaned junction rows. |
| 31 | `POST /wikis` for direct wiki creation | M10 | Frontend and API consumers need REST endpoint, not just MCP tool. |
| 32 | Soft-delete is permanent (no restore) | M10 | Simplifies membership and edge handling. Future cleanup job can purge old rows. |

---

*Updated 2026-04-16 after M3-M10 retro. Detail in `phase-m3-m10-wiki-system.md`.*
