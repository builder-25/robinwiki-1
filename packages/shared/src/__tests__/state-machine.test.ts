import { describe, it, expect } from 'vitest'
import { canTransition, transition, ObjectState, IllegalTransitionError } from '../state-machine'
import type { ObjectType } from '../identity'

describe('ObjectState', () => {
  it('has exactly 4 values: PENDING, RESOLVED, LINKING, DIRTY', () => {
    expect(ObjectState.PENDING).toBe('PENDING')
    expect(ObjectState.RESOLVED).toBe('RESOLVED')
    expect(ObjectState.LINKING).toBe('LINKING')
    expect(ObjectState.DIRTY).toBe('DIRTY')
    expect(Object.keys(ObjectState)).toHaveLength(4)
  })

  it('does not have a FAILED state', () => {
    expect('FAILED' in ObjectState).toBe(false)
  })
})

describe('canTransition', () => {
  describe('standard types (entry, frag, thread, person)', () => {
    const standardTypes: ObjectType[] = ['entry', 'frag', 'wiki', 'person']

    // Valid transitions
    const validTransitions: [string, string][] = [
      ['PENDING', 'RESOLVED'],
      ['PENDING', 'LINKING'],
      ['RESOLVED', 'LINKING'],
      ['RESOLVED', 'DIRTY'],
      ['LINKING', 'RESOLVED'],
      ['LINKING', 'DIRTY'],
      ['DIRTY', 'RESOLVED'],
    ]

    // Invalid transitions
    const invalidTransitions: [string, string][] = [
      ['DIRTY', 'PENDING'],
      ['DIRTY', 'LINKING'],
      ['RESOLVED', 'PENDING'],
      ['PENDING', 'DIRTY'],
      ['LINKING', 'PENDING'],
    ]

    for (const type of standardTypes) {
      describe(`${type}`, () => {
        for (const [from, to] of validTransitions) {
          it(`allows ${from} -> ${to}`, () => {
            expect(canTransition(type, from as ObjectState, to as ObjectState)).toBe(true)
          })
        }

        for (const [from, to] of invalidTransitions) {
          it(`blocks ${from} -> ${to}`, () => {
            expect(canTransition(type, from as ObjectState, to as ObjectState)).toBe(false)
          })
        }

        it('blocks self-transitions', () => {
          for (const state of Object.values(ObjectState)) {
            expect(canTransition(type, state, state)).toBe(false)
          }
        })
      })
    }
  })

  describe('vault', () => {
    it('blocks RESOLVED -> LINKING', () => {
      expect(canTransition('vault', 'RESOLVED', 'LINKING')).toBe(false)
    })

    it('blocks RESOLVED -> DIRTY', () => {
      expect(canTransition('vault', 'RESOLVED', 'DIRTY')).toBe(false)
    })

    it('has no valid transitions from any state', () => {
      for (const from of Object.values(ObjectState)) {
        for (const to of Object.values(ObjectState)) {
          expect(canTransition('vault', from, to)).toBe(false)
        }
      }
    })
  })
})

describe('transition', () => {
  it('returns the target state on valid transition', () => {
    const result = transition('frag01ABC', 'frag', 'PENDING', 'RESOLVED')
    expect(result).toBe('RESOLVED')
  })

  it('throws IllegalTransitionError on invalid transition', () => {
    expect(() => transition('frag01ABC', 'frag', 'RESOLVED', 'PENDING')).toThrow(
      IllegalTransitionError
    )
  })

  it('error message matches exact format', () => {
    try {
      transition('frag01ABC', 'frag', 'RESOLVED', 'PENDING')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTransitionError)
      expect((e as IllegalTransitionError).message).toBe(
        'Illegal transition: frag01ABC RESOLVED -> PENDING (frag)'
      )
    }
  })

  it('error exposes objectKey, objectType, fromState, toState properties', () => {
    try {
      transition('frag01ABC', 'frag', 'RESOLVED', 'PENDING')
      expect.unreachable('should have thrown')
    } catch (e) {
      const err = e as IllegalTransitionError
      expect(err.objectKey).toBe('frag01ABC')
      expect(err.objectType).toBe('frag')
      expect(err.fromState).toBe('RESOLVED')
      expect(err.toState).toBe('PENDING')
    }
  })

  it('throws for vault transitions', () => {
    expect(() => transition('vault01XYZ', 'vault', 'RESOLVED', 'LINKING')).toThrow(
      IllegalTransitionError
    )
  })
})
