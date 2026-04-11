import type { ObjectType } from './identity.js'

// ---------------------------------------------------------------------------
// State enum
// ---------------------------------------------------------------------------

export const ObjectState = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  LINKING: 'LINKING',
  DIRTY: 'DIRTY',
} as const

export type ObjectState = (typeof ObjectState)[keyof typeof ObjectState]

// ---------------------------------------------------------------------------
// Transition tables
// ---------------------------------------------------------------------------

type TransitionMap = Partial<Record<ObjectState, Set<ObjectState>>>

const STANDARD_TRANSITIONS: TransitionMap = {
  PENDING: new Set<ObjectState>(['RESOLVED', 'LINKING']),
  RESOLVED: new Set<ObjectState>(['LINKING', 'DIRTY']),
  LINKING: new Set<ObjectState>(['RESOLVED', 'DIRTY']),
  DIRTY: new Set<ObjectState>(['RESOLVED']),
}

/** Vaults always stay RESOLVED -- no valid transitions. */
const VAULT_TRANSITIONS: TransitionMap = {}

const TRANSITIONS: Record<ObjectType, TransitionMap> = {
  entry: STANDARD_TRANSITIONS,
  frag: STANDARD_TRANSITIONS,
  wiki: STANDARD_TRANSITIONS,
  person: STANDARD_TRANSITIONS,
  vault: VAULT_TRANSITIONS,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check whether a state transition is valid for the given object type. */
export function canTransition(objectType: ObjectType, from: ObjectState, to: ObjectState): boolean {
  const typeMap = TRANSITIONS[objectType]
  if (!typeMap) return false
  const validTargets = typeMap[from]
  if (!validTargets) return false
  return validTargets.has(to)
}

/**
 * Attempt a state transition. Returns the target state on success.
 * Throws {@link IllegalTransitionError} on illegal moves.
 */
export function transition(
  objectKey: string,
  objectType: ObjectType,
  from: ObjectState,
  to: ObjectState
): ObjectState {
  if (!canTransition(objectType, from, to)) {
    throw new IllegalTransitionError(objectKey, objectType, from, to)
  }
  return to
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class IllegalTransitionError extends Error {
  public readonly objectKey: string
  public readonly objectType: string
  public readonly fromState: string
  public readonly toState: string

  constructor(objectKey: string, objectType: string, fromState: string, toState: string) {
    super(`Illegal transition: ${objectKey} ${fromState} -> ${toState} (${objectType})`)
    this.name = 'IllegalTransitionError'
    this.objectKey = objectKey
    this.objectType = objectType
    this.fromState = fromState
    this.toState = toState
  }
}
