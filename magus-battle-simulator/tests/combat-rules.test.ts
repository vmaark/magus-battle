import { createEncounter, resolveAttack } from '../src'
import type { Combatant, DiceRoller } from '../src'

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

const queueRoller = (values: number[]): DiceRoller => {
  let idx = 0
  return (_sides: number) => {
    if (idx >= values.length) throw new Error('Elfogytak az előre definiált dobások.')
    return values[idx++]
  }
}

describe('combat rules parity', () => {
  test('SFÉ teljesen felfoghatja a sebzést (0 nettó sebzés)', () => {
    const attacker = makeCombatant({ id: 'a', weapon: { name: 'Tőr', category: 2, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' } })
    const defender = makeCombatant({
      id: 'd',
      te: 0,
      ve: 100,
      armor: { name: 'Vért', mgt: 0, sfe: 5 },
      fp: 10,
      ep: 10,
    })
    const roller = queueRoller([50, 1])
    const event = resolveAttack(1, attacker, defender, defender.ve, 5, roller, {
      mandatoryEpFromFp: true,
      injuryStatPenalties: true,
    })

    expect(event.hit).toBe(true)
    expect(event.damage).toBe(0)
    expect(event.fpLoss).toBe(0)
    expect(event.epLoss).toBe(0)
    expect(event.appliedRules.some(r => r.ref.code === 'HR-12-SFE-ABSORB')).toBe(true)
  })

  test('0 Ép állapotban lévő célpont ellen a támadás dobás nélkül halálos', () => {
    const attacker = makeCombatant({ id: 'a' })
    const defender = makeCombatant({ id: 'd', ep: 0, fp: 4, status: 'unconscious' })
    const roller = queueRoller([50, 1])
    const event = resolveAttack(1, attacker, defender, defender.ve, 5, roller, {
      mandatoryEpFromFp: true,
      injuryStatPenalties: true,
    })

    expect(event.automaticHit).toBe(true)
    expect(event.automaticFatal).toBe(true)
    expect(event.roll).toBe(0)
    expect(event.defenderStatusAfter).toBe('dead')
    expect(event.appliedRules.some(r => r.ref.code === 'HR-9-MORAL-FOLLOWUP')).toBe(true)
  })

  test('azonos szegmens + azonos kezdeményezés esetén mindkét fél cselekedhet', () => {
    const a = makeCombatant({
      id: 'a',
      name: 'A',
      weapon: { name: 'Nehézkard', category: 4, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' },
      fp: 0,
      ep: 1,
      maxFp: 1,
      maxEp: 1,
    })
    const b = makeCombatant({
      id: 'b',
      name: 'B',
      weapon: { name: 'Nehézkard', category: 4, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' },
      fp: 0,
      ep: 1,
      maxFp: 1,
      maxEp: 1,
    })
    const roller = queueRoller([5, 5, 50, 1, 50, 1])
    const encounter = createEncounter([a], [b], { roller, targeting: 'random' })
    const round = encounter.nextRound()

    expect(round.events).toHaveLength(2)
    expect(round.stateAfter.every(s => s.status !== 'active')).toBe(true)
  })

  test('API esemény tartalmaz strukturált és szöveges szabálykövetést', () => {
    const attacker = makeCombatant({ id: 'a' })
    const defender = makeCombatant({ id: 'd', fp: 10, ep: 10 })
    const event = resolveAttack(
      1,
      attacker,
      defender,
      defender.ve,
      5,
      queueRoller([100, 1]),
      { mandatoryEpFromFp: true, injuryStatPenalties: true },
    )

    expect(event.appliedRules.length).toBeGreaterThan(0)
    for (const rule of event.appliedRules) {
      expect(rule.ref.code).toBeTruthy()
      expect(rule.ref.section).toBeTruthy()
      expect(rule.explanation.length).toBeGreaterThan(0)
    }
  })

  test('külső harci helyzetmódosító hook alkalmazható és naplózódik', () => {
    const a = makeCombatant({
      id: 'a',
      name: 'A',
      te: 60,
      weapon: { name: 'Nehézkard', category: 4, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' },
    })
    const b = makeCombatant({
      id: 'b',
      name: 'B',
      ve: 110,
      weapon: { name: 'Nehézkard', category: 4, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' },
    })
    const encounter = createEncounter([a], [b], {
      roller: queueRoller([5, 5, 50, 1, 1, 1]),
      targeting: 'random',
      ruleHooks: {
        resolveAttackModifiers: () => ({
          attackerTeModifier: 20,
          appliedRules: [
            {
              ref: { code: 'HR-10-HIGH-GROUND', source: 'harcrendszer', section: '§10' },
              explanation: 'Harc magasabbról: +15 TÉ, +5 VÉ (itt csak a támadásra +20 TÉ modellezve).',
            },
          ],
        }),
      },
    })
    const round = encounter.nextRound()
    const event = round.events[0]

    expect(event.hit).toBe(true)
    expect(event.attackerTeTotal).toBe(80)
    expect(event.appliedRules.some(r => r.ref.code === 'HR-10-HIGH-GROUND')).toBe(true)
  })

  test('pancel MGT csokkenti a harcerteket (KE/TE/VE/CE)', () => {
    const a = makeCombatant({
      id: 'a',
      name: 'A',
      ke: 10,
      te: 60,
      ve: 50,
      ce: 10,
      armor: { name: 'Felvertezet', mgt: -4, sfe: 5 },
      weapon: { name: 'Kard', category: 3, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' },
    })
    const b = makeCombatant({
      id: 'b',
      name: 'B',
      ve: 60,
      armor: { name: 'Nincs', mgt: 0, sfe: 0 },
      weapon: { name: 'Kard', category: 3, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k1' },
    })

    const encounter = createEncounter([a], [b], {
      roller: queueRoller([5, 5, 1, 1, 1, 1, 1, 1, 1, 1]),
      targeting: 'random',
    })
    const round = encounter.nextRound()
    const event = round.events.find((e) => e.attackerId === 'a')
    const attackerAfter = round.stateAfter.find((s) => s.id === 'a')

    expect(event).toBeDefined()
    expect(event?.attackerTeTotal).toBe(56)
    expect(attackerAfter?.ke).toBe(6)
    expect(attackerAfter?.te).toBe(56)
    expect(attackerAfter?.ve).toBe(46)
    expect(attackerAfter?.ce).toBe(6)
  })

  test('serulesi modositok: max Fp >90% veszteseg eseten -10 minden harcertek', () => {
    const a = makeCombatant({
      id: 'a',
      name: 'A',
      ke: 20,
      te: 60,
      ve: 55,
      ce: 30,
      maxFp: 100,
      fp: 9,
      armor: { name: 'Nincs', mgt: 0, sfe: 0 },
    })
    const b = makeCombatant({ id: 'b', name: 'B' })
    const encounter = createEncounter([a], [b], {
      roller: queueRoller([1, 1, 1, 1]),
      targeting: 'random',
    })
    const state = encounter.getState()
    const attacker = state.partyA[0]

    expect(attacker.ke).toBe(10)
    expect(attacker.te).toBe(50)
    expect(attacker.ve).toBe(45)
    expect(attacker.ce).toBe(20)
  })

  test('serulesi modositok: 75% Ep vesztesegnel a legsulyosabb buntetes ervenyes', () => {
    const a = makeCombatant({
      id: 'a',
      name: 'A',
      ke: 20,
      te: 60,
      ve: 55,
      ce: 40,
      maxEp: 20,
      ep: 5,
      maxFp: 100,
      fp: 5,
      armor: { name: 'Nincs', mgt: 0, sfe: 0 },
    })
    const b = makeCombatant({ id: 'b', name: 'B' })
    const encounter = createEncounter([a], [b], {
      roller: queueRoller([1, 1, 1, 1]),
      targeting: 'random',
    })
    const state = encounter.getState()
    const attacker = state.partyA[0]

    expect(attacker.ke).toBe(10)
    expect(attacker.te).toBe(40)
    expect(attacker.ve).toBe(45)
    expect(attacker.ce).toBe(10)
  })
})
