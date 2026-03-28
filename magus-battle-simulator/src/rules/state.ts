import type { Combatant, DistanceMap, Party } from '../types'
import { cloneCombatant } from './round-helpers'
import type { RoundState } from './types'

export const buildRoundState = (
  combatants: Map<string, Combatant>,
  partyOf: Map<string, Party>,
  distances: DistanceMap,
  hadEpDamageLastRound: Iterable<string>,
): RoundState => ({
  combatants: Object.fromEntries(
    Array.from(combatants.entries()).map(([id, combatant]) => [id, cloneCombatant(combatant)]),
  ),
  partyOf: Object.fromEntries(Array.from(partyOf.entries())),
  distances: { ...distances },
  hadEpDamageLastRound: Array.from(hadEpDamageLastRound),
})

export const applyRoundStateToMutableStores = (
  state: RoundState,
  combatants: Map<string, Combatant>,
  distances: DistanceMap,
): void => {
  combatants.clear()
  for (const [id, combatant] of Object.entries(state.combatants)) {
    combatants.set(id, cloneCombatant(combatant))
  }

  for (const key of Object.keys(distances)) {
    delete distances[key as keyof DistanceMap]
  }
  Object.assign(distances, state.distances)
}
