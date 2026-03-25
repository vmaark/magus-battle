import type {
  Combatant,
  DistanceKey,
  DistanceMap,
  Encounter,
  EncounterOptions,
  EncounterResult,
  EncounterState,
  EncounterWinner,
  Party,
  RoundResult,
  CombatantPatch,
  CombatantSnapshot,
  OptionalRules,
  DiceRoller,
  TargetingStrategy,
} from './types'
import { defaultRoller } from './dice'
import { deriveStatus } from './combat'
import { resolveRound } from './round'
import { getEffectiveCombatValues } from './stat-modifiers'

const DEFAULT_RULES: OptionalRules = { mandatoryEpFromFp: true, injuryStatPenalties: true }
const DEFAULT_MAX_ROUNDS = 100
const DEFAULT_CLOSE_DISTANCE_PER_ROUND = 39 // Gyorsaság 13, Futva (HR §2)
const DEFAULT_MELEE_REACH_FEET = 5

const distanceKey = (attackerId: string, defenderId: string): DistanceKey =>
  `${attackerId}->${defenderId}`
const isRangedWeapon = (weapon: Combatant['weapon']): boolean =>
  weapon.attackMode === 'ranged' || weapon.ce > 0

export const createEncounter = (
  partyA: Combatant[],
  partyB: Combatant[],
  options: EncounterOptions = {},
): Encounter => {
  const roller: DiceRoller = options.roller ?? defaultRoller
  const targeting: TargetingStrategy = options.targeting ?? 'random'
  const rules: OptionalRules = { ...DEFAULT_RULES, ...options.optionalRules }
  const ruleHooks = options.ruleHooks
  const closeDistancePerRound = Math.max(
    0,
    options.ranged?.closeDistancePerRound ?? DEFAULT_CLOSE_DISTANCE_PER_ROUND,
  )
  const meleeReachFeet = Math.max(0, options.ranged?.meleeReachFeet ?? DEFAULT_MELEE_REACH_FEET)
  const defaultDistanceFeet = Math.max(0, options.ranged?.defaultDistanceFeet ?? 0)

  const combatants = new Map<string, Combatant>()
  const partyOf = new Map<string, Party>()
  const distances: DistanceMap = {}

  for (const c of partyA) {
    combatants.set(c.id, { ...c })
    partyOf.set(c.id, 'a')
  }
  for (const c of partyB) {
    combatants.set(c.id, { ...c })
    partyOf.set(c.id, 'b')
  }

  // Kezdeti távolságok: ha bármelyik fél távolsági fegyvert használ, kapjanak alap távolságot.
  const allCombatants = [...partyA, ...partyB]
  for (const attacker of allCombatants) {
    for (const defender of allCombatants) {
      if (attacker.id === defender.id) continue
      if (partyOf.get(attacker.id) === partyOf.get(defender.id)) continue
      if (isRangedWeapon(attacker.weapon) || isRangedWeapon(defender.weapon)) {
        distances[distanceKey(attacker.id, defender.id)] = defaultDistanceFeet
      } else {
        distances[distanceKey(attacker.id, defender.id)] = 0
      }
    }
  }
  for (const [key, value] of Object.entries(options.ranged?.initialDistances ?? {}) as Array<
    [DistanceKey, number]
  >) {
    distances[key] = Math.max(0, Math.floor(value))
  }

  let currentRound = 0
  let hadEpDamageLastRound = new Set<string>()

  const isOverFn = (): boolean => {
    const vals = Array.from(combatants.values())
    const aActive = vals.some(c => partyOf.get(c.id) === 'a' && c.status === 'active')
    const bActive = vals.some(c => partyOf.get(c.id) === 'b' && c.status === 'active')
    return !aActive || !bActive
  }

  const getWinner = (): EncounterWinner | null => {
    if (!isOverFn()) return null
    const vals = Array.from(combatants.values())
    const aActive = vals.some(c => partyOf.get(c.id) === 'a' && c.status === 'active')
    const bActive = vals.some(c => partyOf.get(c.id) === 'b' && c.status === 'active')
    if (aActive && !bActive) return 'a'
    if (bActive && !aActive) return 'b'
    return 'draw'
  }

  const toSnap = (c: Combatant, party: Party): CombatantSnapshot => {
    const effective = getEffectiveCombatValues(c, {
      injuryStatPenalties: rules.injuryStatPenalties,
    })
    return {
    id: c.id,
    name: c.name,
    party,
    ke: effective.ke,
    te: effective.te,
    ve: effective.ve,
    ce: effective.ce,
    fp: c.fp,
    maxFp: c.maxFp,
    ep: c.ep,
    maxEp: c.maxEp,
    status: c.status,
    weapon: c.weapon,
    armor: c.armor,
    targetId: c.targetId,
    }
  }

  const getStateFn = (): EncounterState => {
    const snap = (party: Party): CombatantSnapshot[] =>
      Array.from(combatants.values())
        .filter(c => partyOf.get(c.id) === party)
        .map(c => toSnap(c, party))
    return {
      round: currentRound,
      partyA: snap('a'),
      partyB: snap('b'),
      distances: { ...distances },
      isOver: isOverFn(),
      winner: getWinner(),
    }
  }

  const nextRound = (): RoundResult => {
    if (isOverFn()) throw new Error('Az ütközet már véget ért.')
    currentRound++
    const result = resolveRound(
      currentRound,
      combatants,
      partyOf,
      hadEpDamageLastRound,
      roller,
      targeting,
      rules,
      distances,
      { closeDistancePerRound, meleeReachFeet },
      ruleHooks,
    )
    // Nyilvántartás a következő kör kezdeményező-levonásához
    const injuredThisRound: string[] = []
    for (const event of result.events) {
      if (event.eventType === 'attack' && event.epLoss > 0) injuredThisRound.push(event.defenderId)
    }
    hadEpDamageLastRound = new Set(injuredThisRound)
    return result
  }

  const run = (maxRounds = DEFAULT_MAX_ROUNDS): EncounterResult => {
    const rounds: RoundResult[] = []
    while (!isOverFn() && rounds.length < maxRounds) rounds.push(nextRound())
    return { rounds, winner: getWinner() }
  }

  const modifyCombatant = (id: string, patch: CombatantPatch): void => {
    const c = combatants.get(id)
    if (!c) throw new Error(`Harcos "${id}" nem található.`)
    Object.assign(c, patch)
    // Állapot levezetése, ha az egészség változott (hacsak a patch maga nem adja meg)
    if ((patch.fp !== undefined || patch.ep !== undefined) && patch.status === undefined) {
      c.status = deriveStatus(c.ep, c.fp)
    }
  }

  const removeCombatant = (id: string): void => {
    combatants.delete(id)
    partyOf.delete(id)
    hadEpDamageLastRound.delete(id)
    for (const key of Object.keys(distances) as DistanceKey[]) {
      if (key.startsWith(`${id}->`) || key.endsWith(`->${id}`)) delete distances[key]
    }
  }

  const addCombatant = (party: Party, combatant: Combatant): void => {
    combatants.set(combatant.id, { ...combatant })
    partyOf.set(combatant.id, party)
    for (const other of combatants.values()) {
      if (other.id === combatant.id) continue
      if (partyOf.get(other.id) === party) continue
      const baseDistance =
        isRangedWeapon(combatant.weapon) || isRangedWeapon(other.weapon) ? defaultDistanceFeet : 0
      distances[distanceKey(combatant.id, other.id)] = baseDistance
      distances[distanceKey(other.id, combatant.id)] = baseDistance
    }
  }

  const setDistance = (attackerId: string, defenderId: string, distanceFeet: number): void => {
    if (!combatants.has(attackerId)) throw new Error(`Harcos "${attackerId}" nem található.`)
    if (!combatants.has(defenderId)) throw new Error(`Harcos "${defenderId}" nem található.`)
    if (partyOf.get(attackerId) === partyOf.get(defenderId)) {
      throw new Error('Távolság csak ellentétes oldali harcosok között értelmezett.')
    }
    const normalized = Math.max(0, Math.floor(distanceFeet))
    distances[distanceKey(attackerId, defenderId)] = normalized
    distances[distanceKey(defenderId, attackerId)] = normalized
  }

  const getDistance = (attackerId: string, defenderId: string): number | null => {
    const d = distances[distanceKey(attackerId, defenderId)]
    if (!Number.isFinite(d)) return null
    return Math.max(0, Number(d))
  }

  return {
    nextRound,
    run,
    modifyCombatant,
    removeCombatant,
    addCombatant,
    getState: getStateFn,
    setDistance,
    getDistance,
    isOver: isOverFn,
  }
}
