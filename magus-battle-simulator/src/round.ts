import type {
  Combatant,
  RoundResult,
  DiceRoller,
  TargetingStrategy,
  OptionalRules,
  CombatRuleHooks,
  DistanceMap,
  Party,
} from './types'
import { resolveRoundPure } from './rules/round-engine'
import { applyRoundStateToMutableStores, buildRoundState } from './rules/state'
import type { RangedRoundSettings } from './rules/types'

/**
 * Egy teljes kör végrehajtása.
 * A `combatants` Map tartalmát a függvény helyben módosítja (védők Fp/Ép/státusz).
 */
export const resolveRound = (
  roundNumber: number,
  combatants: Map<string, Combatant>,
  partyOf: Map<string, Party>,
  hadEpDamageLastRound: Set<string>,
  roller: DiceRoller,
  strategy: TargetingStrategy,
  rules: OptionalRules,
  distances: DistanceMap,
  ranged: RangedRoundSettings,
  ruleHooks?: CombatRuleHooks,
): RoundResult => {
  const transition = resolveRoundPure(
    buildRoundState(combatants, partyOf, distances, hadEpDamageLastRound),
    {
      roundNumber,
      targeting: strategy,
      rules,
      ranged,
      random: {
        roller,
        targetRng: Math.random,
      },
      ruleHooks,
    },
  )
  applyRoundStateToMutableStores(transition.nextState, combatants, distances)
  return transition.roundResult
}
