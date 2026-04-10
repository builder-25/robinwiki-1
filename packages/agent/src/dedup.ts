/**
 * Jaccard similarity on lowercased word sets.
 * Returns 0 for empty inputs.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))

  if (setA.size === 0 && setB.size === 0) return 0

  let intersection = 0
  for (const word of setA) {
    if (setB.has(word)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Pairwise dedup within a batch of fragments.
 * When two fragments exceed the similarity threshold, the one with lower confidence is dropped.
 */
export function dedupBatch<T extends { content: string; confidence: number }>(
  fragments: T[],
  threshold = 0.6
): T[] {
  if (fragments.length <= 1) return fragments

  const dropped = new Set<number>()

  for (let i = 0; i < fragments.length; i++) {
    if (dropped.has(i)) continue
    for (let j = i + 1; j < fragments.length; j++) {
      if (dropped.has(j)) continue
      const sim = jaccardSimilarity(fragments[i].content, fragments[j].content)
      if (sim >= threshold) {
        // Drop the one with lower confidence
        if (fragments[i].confidence >= fragments[j].confidence) {
          dropped.add(j)
        } else {
          dropped.add(i)
          break // i is dropped, stop comparing it
        }
      }
    }
  }

  return fragments.filter((_, idx) => !dropped.has(idx))
}
