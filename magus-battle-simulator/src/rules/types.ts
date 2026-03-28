import type {
  CombatRuleHooks,
  Combatant,
  DistanceMap,
  OptionalRules,
  Party,
  RoundResult,
  TargetingStrategy,
} from '../types'
import type { DiceRoller } from '../types'

export type RoundState = {
  combatants: Record<string, Combatant>
  partyOf: Record<string, Party>
  distances: DistanceMap
  hadEpDamageLastRound: string[]
}

export type RangedRoundSettings = {
  closeDistancePerRound: number
  meleeReachFeet: number
}

export type RandomSources = {
  roller: DiceRoller
  targetRng: () => number
}

export type RoundContext = {
  roundNumber: number
  targeting: TargetingStrategy
  rules: OptionalRules
  ranged: RangedRoundSettings
  random: RandomSources
  ruleHooks?: CombatRuleHooks
}

export type RoundTransition = {
  nextState: RoundState
  roundResult: RoundResult
}
