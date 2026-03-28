import { resolveAttack } from '../combat'
import { getEffectiveCombatValues } from '../stat-modifiers'
import type {
  ActionEvent,
  AppliedRule,
  AttackMode,
  CombatEvent,
  Combatant,
  InitiativeEntry,
} from '../types'
import {
  buildActionQueue,
  cloneCombatant,
  computeOutnumberedPenalties,
  describeInjuryPenalty,
  getEngagementIntent,
  groupSimultaneousSlots,
  isRangedWeapon,
  selectTarget,
  setPairDistance,
  toSnapshot,
} from './round-helpers'
import type { RoundContext, RoundState, RoundTransition } from './types'

const cloneState = (state: RoundState): RoundState => ({
  combatants: Object.fromEntries(
    Object.entries(state.combatants).map(([id, combatant]) => [id, cloneCombatant(combatant)]),
  ),
  partyOf: { ...state.partyOf },
  distances: { ...state.distances },
  hadEpDamageLastRound: [...state.hadEpDamageLastRound],
})

const sortedCombatants = (combatants: Record<string, Combatant>): Combatant[] =>
  Object.values(combatants).sort((a, b) => a.id.localeCompare(b.id))

export const resolveRoundPure = (state: RoundState, context: RoundContext): RoundTransition => {
  const nextState = cloneState(state)
  const all = sortedCombatants(nextState.combatants)
  const active = all.filter(c => c.status === 'active')
  const injuryStatPenalties = context.rules.injuryStatPenalties

  const initiatives: Record<string, { die: number; total: number; lost: boolean }> = {}
  const initiativeEntries: InitiativeEntry[] = []

  for (const c of active) {
    const lost = nextState.hadEpDamageLastRound.includes(c.id)
    const die = lost ? 0 : context.random.roller(10)
    const total = lost ? -1 : die + getEffectiveCombatValues(c, { injuryStatPenalties }).ke
    initiatives[c.id] = { die, total, lost }
    initiativeEntries.push({ combatantId: c.id, name: c.name, die, total, lostInitiative: lost })
  }

  initiativeEntries.sort((a, b) => {
    if (a.lostInitiative !== b.lostInitiative) return a.lostInitiative ? 1 : -1
    return b.total - a.total
  })

  const outnumberedPenalties = computeOutnumberedPenalties(
    active,
    all,
    nextState.partyOf,
    context.targeting,
    nextState.distances,
    context.ranged,
    injuryStatPenalties,
    context.random.targetRng,
  )

  const queue = buildActionQueue(active, initiatives)
  const events: CombatEvent[] = []
  const groups = groupSimultaneousSlots(queue)
  const spentMovementThisRound = new Set<string>()

  for (const group of groups) {
    const snapshotById = Object.fromEntries(
      Object.entries(nextState.combatants).map(([id, c]) => [id, cloneCombatant(c)]),
    ) as Record<string, Combatant>
    const distanceSnapshot = { ...nextState.distances }
    const activeAtGroupStart = new Set(
      group
        .map(s => s.combatantId)
        .filter(id => snapshotById[id]?.status === 'active'),
    )

    for (const slot of group) {
      if (!activeAtGroupStart.has(slot.combatantId)) continue
      if (spentMovementThisRound.has(slot.combatantId)) continue
      const attacker = snapshotById[slot.combatantId]
      if (!attacker) continue

      const party = nextState.partyOf[attacker.id]
      const enemies = Object.values(snapshotById).filter(
        c => nextState.partyOf[c.id] !== party && c.status === 'active',
      )
      const target = selectTarget(
        attacker,
        enemies,
        context.targeting,
        nextState.partyOf,
        injuryStatPenalties,
        context.random.targetRng,
      )
      if (!target) continue
      const intent = getEngagementIntent(attacker, target, distanceSnapshot, context.ranged)
      if (intent.type === 'close_distance') {
        const distanceBefore = intent.distanceFeet
        const distanceAfter = Math.max(0, distanceBefore - context.ranged.closeDistancePerRound)
        nextState.distances = setPairDistance(nextState.distances, attacker.id, target.id, distanceAfter)
        const actionEvent: ActionEvent = {
          eventType: 'action',
          round: context.roundNumber,
          segment: slot.segment,
          actorId: attacker.id,
          actorName: attacker.name,
          actionType: 'close_distance',
          reason: intent.reason,
          targetId: target.id,
          targetName: target.name,
          distanceBeforeFeet: distanceBefore,
          distanceAfterFeet: distanceAfter,
          appliedRules: [
            {
              ref: { code: 'HR-2-MOVE-RUN', source: 'harcrendszer', section: '§2' },
              explanation: `Zárkózás Futva szerint: ${context.ranged.closeDistancePerRound} láb csökkentés ebben a körben.`,
            },
          ],
        }
        events.push(actionEvent)
        spentMovementThisRound.add(attacker.id)
        continue
      }
      if (intent.type === 'invalid') {
        const actionEvent: ActionEvent = {
          eventType: 'action',
          round: context.roundNumber,
          segment: slot.segment,
          actorId: attacker.id,
          actorName: attacker.name,
          actionType: 'no_valid_target',
          reason: intent.reason,
          targetId: target.id,
          targetName: target.name,
          distanceBeforeFeet: intent.distanceFeet ?? undefined,
          distanceAfterFeet: intent.distanceFeet ?? undefined,
          appliedRules: [
            {
              ref: { code: 'HR-7-RANGED-RANGE', source: 'harcrendszer', section: '§7' },
              explanation: 'A támadás a hatótávon kívül volt, ezért nem hajtható végre.',
            },
          ],
        }
        events.push(actionEvent)
        continue
      }

      const attackMode: AttackMode = isRangedWeapon(attacker.weapon) ? 'ranged' : 'melee'
      const penalty = attackMode === 'melee' ? (outnumberedPenalties[target.id] ?? 0) : 0
      const targetSnap = toSnapshot(target, nextState.partyOf[target.id], injuryStatPenalties)
      const attackerSnap = toSnapshot(attacker, party, injuryStatPenalties)

      const modifier = context.ruleHooks?.resolveAttackModifiers?.({
        round: context.roundNumber,
        segment: slot.segment,
        attacker: attackerSnap,
        defender: targetSnap,
      })
      const attackerTeModifier = modifier?.attackerTeModifier ?? 0
      const attackerCeModifier = modifier?.attackerCeModifier ?? 0
      const defenderVeModifier = modifier?.defenderVeModifier ?? 0
      const appliedRules: AppliedRule[] = [...(modifier?.appliedRules ?? [])]
      if (penalty > 0) {
        appliedRules.push({
          ref: { code: 'HR-11-OUTNUMBERED', source: 'harcrendszer', section: '§11' },
          explanation: `Túlerő miatt a védő VÉ-je ${penalty} ponttal csökkent.`,
        })
      }
      if (defenderVeModifier !== 0) {
        appliedRules.push({
          ref: { code: 'HR-10-COMBAT-MOD', source: 'harcrendszer', section: '§10' },
          explanation: `Harci helyzetmódosító alkalmazva: védő VÉ ${defenderVeModifier >= 0 ? '+' : ''}${defenderVeModifier}.`,
        })
      }

      const targetEffective = getEffectiveCombatValues(target, { injuryStatPenalties })
      const attackerEffective = getEffectiveCombatValues(attacker, { injuryStatPenalties })
      if (attackerEffective.injury.code) {
        appliedRules.push({
          ref: { code: attackerEffective.injury.code, source: 'eletero', section: '§5' },
          explanation: describeInjuryPenalty(attackerEffective.injury.code),
        })
      }
      if (targetEffective.injury.code) {
        appliedRules.push({
          ref: { code: targetEffective.injury.code, source: 'eletero', section: '§5' },
          explanation: describeInjuryPenalty(targetEffective.injury.code),
        })
      }
      const effectiveVe = targetEffective.ve - penalty + defenderVeModifier
      const effectiveAttacker = { ...attacker, ...attackerEffective }
      const effectiveDefense =
        attackMode === 'ranged'
          ? (intent.rangedDefenseBase ?? 50) + defenderVeModifier
          : effectiveVe
      if (attackMode === 'ranged') {
        appliedRules.push({
          ref: { code: 'HR-7-RANGED-DEFENSE', source: 'harcrendszer', section: '§7' },
          explanation: `Távolsági VÉ alap: távolság + 50 = ${intent.rangedDefenseBase ?? 50}.`,
        })
      }
      const event = resolveAttack(
        context.roundNumber,
        effectiveAttacker,
        target,
        effectiveDefense,
        slot.segment,
        context.random.roller,
        context.rules,
        attackerTeModifier,
        attackerCeModifier,
        attackMode,
        intent.distanceFeet ?? undefined,
        intent.rangedDefenseBase,
        appliedRules,
      )
      events.push(event)

      if (!event.hit) continue

      const liveDefender = nextState.combatants[target.id]
      if (!liveDefender) continue
      liveDefender.fp = Math.max(0, liveDefender.fp - event.fpLoss)
      liveDefender.ep = liveDefender.ep - event.epLoss
      liveDefender.status = event.defenderStatusAfter
      event.defenderFpAfter = liveDefender.fp
      event.defenderEpAfter = liveDefender.ep
      event.defenderStatusAfter = liveDefender.status
    }
  }

  const injuredThisRound: string[] = []
  for (const event of events) {
    if (event.eventType === 'attack' && event.epLoss > 0) injuredThisRound.push(event.defenderId)
  }
  nextState.hadEpDamageLastRound = injuredThisRound

  const stateAfter = sortedCombatants(nextState.combatants).map(c =>
    toSnapshot(c, nextState.partyOf[c.id], injuryStatPenalties),
  )

  return {
    nextState,
    roundResult: {
      round: context.roundNumber,
      initiatives: initiativeEntries,
      outnumberedPenalties,
      events,
      stateAfter,
    },
  }
}
