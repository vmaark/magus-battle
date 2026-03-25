import type {
  Combatant,
  Encounter,
  EncounterOptions,
  EncounterResult,
  EncounterState,
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

export const createEncounter = (
  partyA: Combatant[],
  partyB: Combatant[],
  options: EncounterOptions = {},
): Encounter => {
  const roller: DiceRoller = options.roller ?? defaultRoller
  const targeting: TargetingStrategy = options.targeting ?? 'random'
  const rules: OptionalRules = { ...DEFAULT_RULES, ...options.optionalRules }
  const ruleHooks = options.ruleHooks

  const combatants = new Map<string, Combatant>()
  const partyOf = new Map<string, 'a' | 'b'>()

  for (const c of partyA) {
    combatants.set(c.id, { ...c })
    partyOf.set(c.id, 'a')
  }
  for (const c of partyB) {
    combatants.set(c.id, { ...c })
    partyOf.set(c.id, 'b')
  }

  let currentRound = 0
  let hadEpDamageLastRound = new Set<string>()

  const isOverFn = (): boolean => {
    const vals = Array.from(combatants.values())
    const aActive = vals.some(c => partyOf.get(c.id) === 'a' && c.status === 'active')
    const bActive = vals.some(c => partyOf.get(c.id) === 'b' && c.status === 'active')
    return !aActive || !bActive
  }

  const getWinner = (): 'a' | 'b' | 'draw' | null => {
    if (!isOverFn()) return null
    const vals = Array.from(combatants.values())
    const aActive = vals.some(c => partyOf.get(c.id) === 'a' && c.status === 'active')
    const bActive = vals.some(c => partyOf.get(c.id) === 'b' && c.status === 'active')
    if (aActive && !bActive) return 'a'
    if (bActive && !aActive) return 'b'
    return 'draw'
  }

  const toSnap = (c: Combatant, party: 'a' | 'b'): CombatantSnapshot => {
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
    const snap = (party: 'a' | 'b'): CombatantSnapshot[] =>
      Array.from(combatants.values())
        .filter(c => partyOf.get(c.id) === party)
        .map(c => toSnap(c, party))
    return {
      round: currentRound,
      partyA: snap('a'),
      partyB: snap('b'),
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
      ruleHooks,
    )
    // Nyilvántartás a következő kör kezdeményező-levonásához
    hadEpDamageLastRound = new Set(
      result.events.filter(e => e.epLoss > 0).map(e => e.defenderId),
    )
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
  }

  const addCombatant = (party: 'a' | 'b', combatant: Combatant): void => {
    combatants.set(combatant.id, { ...combatant })
    partyOf.set(combatant.id, party)
  }

  return {
    nextRound,
    run,
    modifyCombatant,
    removeCombatant,
    addCombatant,
    getState: getStateFn,
    isOver: isOverFn,
  }
}
