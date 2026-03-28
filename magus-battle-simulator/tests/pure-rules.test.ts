import {
  buildActionQueue,
  computeOutnumberedPenalties,
  resolveRoundPure,
  selectTarget,
} from '../src'
import type { Combatant, RoundState } from '../src'

const makeCombatant = (overrides: Partial<Combatant>): Combatant => ({
  id: 'c',
  name: 'Harcos',
  ke: 10,
  te: 100,
  ve: 80,
  ce: 0,
  maxEp: 10,
  ep: 10,
  maxFp: 10,
  fp: 10,
  weapon: { name: 'Kard', category: 3, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k6' },
  armor: { name: 'Nincs', mgt: 0, sfe: 0 },
  isPlayerCharacter: false,
  status: 'active',
  ...overrides,
})

describe('pure rules helpers', () => {
  test('selectTarget random strategy is deterministic via injected RNG', () => {
    const attacker = makeCombatant({ id: 'a' })
    const enemies = [
      makeCombatant({ id: 'b', name: 'B' }),
      makeCombatant({ id: 'c', name: 'C' }),
      makeCombatant({ id: 'd', name: 'D' }),
    ]
    const partyOf = { a: 'a', b: 'b', c: 'b', d: 'b' } as const

    const selected = selectTarget(attacker, enemies, 'random', partyOf, true, () => 0.51)
    expect(selected?.id).toBe('c')
  })

  test('buildActionQueue keeps segment + initiative ordering', () => {
    const a = makeCombatant({
      id: 'a',
      weapon: { name: 'Tőr', category: 2, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k6' },
    })
    const b = makeCombatant({
      id: 'b',
      weapon: { name: 'Nehézkard', category: 4, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k6' },
    })
    const queue = buildActionQueue([a, b], {
      a: { total: 12, lost: false },
      b: { total: 14, lost: false },
    })

    expect(queue[0]).toMatchObject({ combatantId: 'a', segment: 3, initiative: 12 })
    expect(queue[queue.length - 1]).toMatchObject({ combatantId: 'b', segment: 10 })
  })

  test('computeOutnumberedPenalties counts attackers per defender', () => {
    const a1 = makeCombatant({ id: 'a1', targetId: 'b1' })
    const a2 = makeCombatant({ id: 'a2', targetId: 'b1' })
    const b1 = makeCombatant({ id: 'b1' })
    const all = [a1, a2, b1]
    const penalties = computeOutnumberedPenalties(
      [a1, a2, b1],
      all,
      { a1: 'a', a2: 'a', b1: 'b' },
      'random',
      {},
      { closeDistancePerRound: 39, meleeReachFeet: 5 },
      true,
      () => 0,
    )

    expect(penalties.b1).toBe(5)
  })
})

describe('resolveRoundPure', () => {
  test('returns nextState without mutating input state object', () => {
    const a = makeCombatant({ id: 'a', name: 'A' })
    const b = makeCombatant({ id: 'b', name: 'B' })
    const inputState: RoundState = {
      combatants: { a, b },
      partyOf: { a: 'a', b: 'b' },
      distances: {},
      hadEpDamageLastRound: [],
    }

    const before = JSON.stringify(inputState)
    const transition = resolveRoundPure(inputState, {
      roundNumber: 1,
      targeting: 'weakest',
      rules: { mandatoryEpFromFp: true, injuryStatPenalties: true },
      ranged: { closeDistancePerRound: 39, meleeReachFeet: 5 },
      random: {
        roller: () => 1,
        targetRng: () => 0,
      },
    })

    expect(transition.roundResult.round).toBe(1)
    expect(transition.nextState).not.toBe(inputState)
    expect(JSON.stringify(inputState)).toBe(before)
  })
})
