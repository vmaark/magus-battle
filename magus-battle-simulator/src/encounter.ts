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
import { getEffectiveCombatValues } from './stat-modifiers'
import { distanceKey, isRangedWeapon } from './rules/round-helpers'
import { resolveRoundPure } from './rules/round-engine'
import type { RoundState } from './rules/types'
import { MAGUS_EQUIPMENT_DATA } from './equipment-data'

const DEFAULT_RULES: OptionalRules = { mandatoryEpFromFp: true, injuryStatPenalties: true }
const DEFAULT_MAX_ROUNDS = 100
const DEFAULT_CLOSE_DISTANCE_PER_ROUND = 39 // Gyorsaság 13, Futva (HR §2)
const DEFAULT_MELEE_REACH_FEET = 5

const normalizeLookup = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const WEAPON_TIME_BY_NAME = new Map<string, number>()
for (const weapon of MAGUS_EQUIPMENT_DATA.weapons) {
  if (typeof weapon.time !== 'number') continue
  if (!Number.isFinite(weapon.time) || weapon.time <= 0) continue
  const key = normalizeLookup(weapon.name)
  if (!WEAPON_TIME_BY_NAME.has(key)) WEAPON_TIME_BY_NAME.set(key, Math.floor(weapon.time))
}

const enrichWeaponTime = (weapon: Combatant['weapon']): Combatant['weapon'] => {
  if (Number.isFinite(weapon.time) && Number(weapon.time) > 0) {
    return { ...weapon, time: Math.floor(Number(weapon.time)) }
  }
  const derived = WEAPON_TIME_BY_NAME.get(normalizeLookup(weapon.name))
  if (!derived) return { ...weapon }
  return { ...weapon, time: derived }
}

const cloneCombatant = (combatant: Combatant): Combatant => ({
  ...combatant,
  weapon: enrichWeaponTime(combatant.weapon),
  armor: { ...combatant.armor },
})

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

  const combatants: Record<string, Combatant> = {}
  const partyOf: Record<string, Party> = {}
  const distances: DistanceMap = {}

  for (const c of partyA) {
    combatants[c.id] = cloneCombatant(c)
    partyOf[c.id] = 'a'
  }
  for (const c of partyB) {
    combatants[c.id] = cloneCombatant(c)
    partyOf[c.id] = 'b'
  }

  // Kezdeti távolságok: ha bármelyik fél távolsági fegyvert használ, kapjanak alap távolságot.
  const allCombatants = [...partyA, ...partyB]
  for (const attacker of allCombatants) {
    for (const defender of allCombatants) {
      if (attacker.id === defender.id) continue
      if (partyOf[attacker.id] === partyOf[defender.id]) continue
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
  let state: RoundState = {
    combatants,
    partyOf,
    distances,
    hadEpDamageLastRound: [],
  }

  const isOverFn = (): boolean => {
    const vals = Object.values(state.combatants)
    const aActive = vals.some(c => state.partyOf[c.id] === 'a' && c.status === 'active')
    const bActive = vals.some(c => state.partyOf[c.id] === 'b' && c.status === 'active')
    return !aActive || !bActive
  }

  const getWinner = (): EncounterWinner | null => {
    if (!isOverFn()) return null
    const vals = Object.values(state.combatants)
    const aActive = vals.some(c => state.partyOf[c.id] === 'a' && c.status === 'active')
    const bActive = vals.some(c => state.partyOf[c.id] === 'b' && c.status === 'active')
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
      Object.values(state.combatants)
        .filter(c => state.partyOf[c.id] === party)
        .map(c => toSnap(c, party))
    return {
      round: currentRound,
      partyA: snap('a'),
      partyB: snap('b'),
      distances: { ...state.distances },
      isOver: isOverFn(),
      winner: getWinner(),
    }
  }

  const nextRound = (): RoundResult => {
    if (isOverFn()) throw new Error('Az ütközet már véget ért.')
    currentRound++
    const transition = resolveRoundPure(state, {
      roundNumber: currentRound,
      targeting,
      rules,
      ranged: { closeDistancePerRound, meleeReachFeet },
      random: {
        roller,
        targetRng: Math.random,
      },
      ruleHooks,
    })
    state = transition.nextState
    return transition.roundResult
  }

  const run = (maxRounds = DEFAULT_MAX_ROUNDS): EncounterResult => {
    const rounds: RoundResult[] = []
    while (!isOverFn() && rounds.length < maxRounds) rounds.push(nextRound())
    return { rounds, winner: getWinner() }
  }

  const modifyCombatant = (id: string, patch: CombatantPatch): void => {
    const c = state.combatants[id]
    if (!c) throw new Error(`Harcos "${id}" nem található.`)
    Object.assign(c, patch)
    c.weapon = enrichWeaponTime(c.weapon)
    // Állapot levezetése, ha az egészség változott (hacsak a patch maga nem adja meg)
    if ((patch.fp !== undefined || patch.ep !== undefined) && patch.status === undefined) {
      c.status = deriveStatus(c.ep, c.fp)
    }
  }

  const removeCombatant = (id: string): void => {
    delete state.combatants[id]
    delete state.partyOf[id]
    state.hadEpDamageLastRound = state.hadEpDamageLastRound.filter(combatantId => combatantId !== id)
    for (const key of Object.keys(state.distances) as DistanceKey[]) {
      if (key.startsWith(`${id}->`) || key.endsWith(`->${id}`)) delete state.distances[key]
    }
  }

  const addCombatant = (party: Party, combatant: Combatant): void => {
    state.combatants[combatant.id] = cloneCombatant(combatant)
    state.partyOf[combatant.id] = party
    for (const other of Object.values(state.combatants)) {
      if (other.id === combatant.id) continue
      if (state.partyOf[other.id] === party) continue
      const baseDistance =
        isRangedWeapon(combatant.weapon) || isRangedWeapon(other.weapon) ? defaultDistanceFeet : 0
      state.distances[distanceKey(combatant.id, other.id)] = baseDistance
      state.distances[distanceKey(other.id, combatant.id)] = baseDistance
    }
  }

  const setDistance = (attackerId: string, defenderId: string, distanceFeet: number): void => {
    if (!state.combatants[attackerId]) throw new Error(`Harcos "${attackerId}" nem található.`)
    if (!state.combatants[defenderId]) throw new Error(`Harcos "${defenderId}" nem található.`)
    if (state.partyOf[attackerId] === state.partyOf[defenderId]) {
      throw new Error('Távolság csak ellentétes oldali harcosok között értelmezett.')
    }
    const normalized = Math.max(0, Math.floor(distanceFeet))
    state.distances[distanceKey(attackerId, defenderId)] = normalized
    state.distances[distanceKey(defenderId, attackerId)] = normalized
  }

  const getDistance = (attackerId: string, defenderId: string): number | null => {
    const d = state.distances[distanceKey(attackerId, defenderId)]
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
