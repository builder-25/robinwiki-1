import { monotonicFactory } from 'ulidx'

export const ObjectType = {
  ENTRY: 'entry',
  FRAGMENT: 'frag',
  WIKI: 'wiki',
  PERSON: 'person',
  VAULT: 'vault',
} as const

export type ObjectType = (typeof ObjectType)[keyof typeof ObjectType]

/** Map type prefix to directory name */
export const TYPE_TO_DIR: Record<ObjectType, string> = {
  entry: 'entries',
  frag: 'fragments',
  wiki: 'wikis',
  person: 'people',
  vault: '',
}

/**
 * @summary Regex patterns for matching lookup keys by type.
 *
 * @remarks
 * Canonical format: `{prefix}[0-9A-Z]{26}` (Crockford Base32 ULID, no separator).
 * Use these for extraction from unstructured text (e.g. MCP response bodies, logs).
 *
 * @example
 * ```ts
 * const match = text.match(LOOKUP_KEY_RE.entry)
 * // match[0] === 'entry01KMJBYN40EK57JDH4RXWNKETV'
 * ```
 */
export const LOOKUP_KEY_RE: Record<ObjectType, RegExp> = {
  entry: /entry[0-9A-Z]{26}/,
  frag: /frag[0-9A-Z]{26}/,
  wiki: /wiki[0-9A-Z]{26}/,
  person: /person[0-9A-Z]{26}/,
  vault: /vault[0-9A-Z]{26}/,
}

/** Match any lookup key regardless of type */
export const ANY_LOOKUP_KEY_RE = /(?:entry|frag|wiki|person|vault)[0-9A-Z]{26}/

const generateUlid = monotonicFactory()

/** Generate a type-prefixed lookup key, e.g. "frag01HZY3Q9R3..." */
export function makeLookupKey(type: ObjectType): string {
  return `${type}${generateUlid()}`
}

/** Extract the type prefix and raw ULID from a lookup key */
export function parseLookupKey(key: string): { type: ObjectType; ulid: string } {
  for (const prefix of Object.values(ObjectType)) {
    if (key.startsWith(prefix)) {
      return { type: prefix, ulid: key.slice(prefix.length) }
    }
  }
  throw new Error(`Unknown type prefix in key: ${key}`)
}
