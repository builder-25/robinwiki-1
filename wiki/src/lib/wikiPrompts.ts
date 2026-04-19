/**
 * wikiPrompts.ts — legacy API surface, now a shim.
 *
 * Prior to the prompt-backend-reconcile phase this module shipped hardcoded
 * defaults. The canonical source is now the Hono /wiki-types endpoint
 * (core/src/routes/wiki-types.ts). This shim preserves the two consumer-facing
 * functions used by AddWikiModal (Phase 3 scope) until that modal is rewritten.
 *
 * Full deletion is scheduled for the prompt-per-wiki-override phase.
 */

interface ShimEntry {
  /** Canonical YAML from disk — used as the prompt "default" for AddWikiModal seed flows. */
  defaultPrompt: string;
  /** Display label, title-cased by the spec. */
  label: string;
}

const cache = new Map<string, ShimEntry>();

export interface WikiTypesHydrationItem {
  slug: string;
  displayLabel: string;
  defaultYaml: string;
  promptYaml: string;
}

/**
 * Replace the shim cache with fresh API data. Call after useWikiTypesList resolves.
 */
export function hydrateFromWikiTypes(items: WikiTypesHydrationItem[]): void {
  cache.clear();
  for (const t of items) {
    // Prefer the canonical defaultYaml; fall back to the current promptYaml if the
    // server returned no disk YAML (e.g. user-created slugs). Matches pre-shim behavior
    // where getDefaultPrompt returned the built-in template string.
    const d = t.defaultYaml || t.promptYaml || "";
    cache.set(t.slug, { defaultPrompt: d, label: t.displayLabel });
  }
}

/** @returns default YAML blob for a slug, or null if the slug is unknown. */
export function getDefaultPrompt(typeKey: string): string | null {
  const entry = cache.get(typeKey);
  return entry ? entry.defaultPrompt : null;
}

/** @returns display label for a slug, or a title-cased fallback of the slug. */
export function getWikiTypeLabel(typeKey: string): string {
  const entry = cache.get(typeKey);
  if (entry) return entry.label;
  if (!typeKey) return "";
  return typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
}
