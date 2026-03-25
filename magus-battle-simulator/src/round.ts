/**
 * Egy teljes harci kör végrehajtása.
 * Szabályok: harcrendszer.md §1, §5, §11, §12
 */

import type {
  AttackMode,
  Combatant,
  RoundResult,
  InitiativeEntry,
  CombatEvent,
  ActionEvent,
  DiceRoller,
  TargetingStrategy,
  OptionalRules,
  CombatantSnapshot,
  CombatRuleHooks,
  AppliedRule,
  DistanceKey,
  DistanceMap,
  InjuryPenaltyCode,
  Party,
} from './types'
import { SEGMENT_COST, ROUND_SEGMENTS } from './types'
import { deriveStatus, resolveAttack } from './combat'
import { getEffectiveCombatValues } from './stat-modifiers'

/** Túlerő miatti VÉ-levonás (harcrendszer.md §11) */
const OUTNUMBERED_VE_PENALTY: Record<number, number> = {
  1: 0,
  2: 5,
  3: 10,
  4: 15,
  5: 20,
  6: 25,
  7: 30,
  8: 35,
}

type ActionSlot = {
  combatantId: string
  segment: number
  initiative: number
  lostInitiative: boolean
}

type RangedRoundSettings = {
  closeDistancePerRound: number
  meleeReachFeet: number
}

const distanceKey = (attackerId: string, defenderId: string): DistanceKey =>
  `${attackerId}->${defenderId}`

const isRangedWeapon = (weapon: Combatant['weapon']): boolean =>
  weapon.attackMode === 'ranged' || weapon.ce > 0

const getWeaponRange = (weapon: Combatant['weapon']): number | null => {
  if (Number.isFinite(weapon.rangeFeet)) return Math.max(0, Number(weapon.rangeFeet))
  return null
}

const getPairDistance = (
  distances: DistanceMap,
  aId: string,
  bId: string,
): number | null => {
  const direct = distances[distanceKey(aId, bId)]
  if (Number.isFinite(direct)) return Math.max(0, Number(direct))
  const reverse = distances[distanceKey(bId, aId)]
  if (Number.isFinite(reverse)) return Math.max(0, Number(reverse))
  return null
}

const setPairDistance = (
  distances: DistanceMap,
  aId: string,
  bId: string,
  value: number,
): void => {
  const normalized = Math.max(0, Math.floor(value))
  distances[distanceKey(aId, bId)] = normalized
  distances[distanceKey(bId, aId)] = normalized
}

type EngagementIntent =
  | {
      type: 'attack'
      distanceFeet: number | null
      rangedDefenseBase?: number
    }
  | {
      type: 'close_distance'
      distanceFeet: number
      reason: string
    }
  | {
      type: 'invalid'
      reason: string
      distanceFeet: number | null
    }

const getEngagementIntent = (
  attacker: Combatant,
  defender: Combatant,
  distances: DistanceMap,
  ranged: RangedRoundSettings,
): EngagementIntent => {
  const attackerRanged = isRangedWeapon(attacker.weapon)
  const defenderRanged = isRangedWeapon(defender.weapon)
  const distanceFeet = getPairDistance(distances, attacker.id, defender.id)
  const meleeDistance = distanceFeet ?? 0

  if (attackerRanged) {
    const rangeFeet = getWeaponRange(attacker.weapon)
    if (rangeFeet !== null && meleeDistance > rangeFeet) {
      return {
        type: 'close_distance',
        distanceFeet: meleeDistance,
        reason: `A célpont ${meleeDistance} lábra van, ami kívül esik a fegyver ${rangeFeet} lábas hatótávján, ezért a támadó közelebb zárkózik.`,
      }
    }
    return {
      type: 'attack',
      distanceFeet: meleeDistance,
      rangedDefenseBase: meleeDistance + 50,
    }
  }

  // Közelharcos csak akkor támadhat távolságon, ha a másik is közelharci közelségben van.
  if (defenderRanged && meleeDistance > ranged.meleeReachFeet) {
    return {
      type: 'close_distance',
      distanceFeet: meleeDistance,
      reason:
        'A célpont távolsági harcos és még nincs közelharci távolságban, ezért a támadó zárkózik.',
    }
  }

  return { type: 'attack', distanceFeet: meleeDistance }
}

const describeInjuryPenalty = (code: InjuryPenaltyCode): string => {
  switch (code) {
    case 'ET-5-INJURY-FP90':
      return 'Sérülési módosító: a max Fp több mint 90%-a elveszett, ezért -10 minden harcérték.'
    case 'ET-5-INJURY-EP50':
      return 'Sérülési módosító: a max Ép legalább fele elveszett, ezért -10 minden harcérték.'
    case 'ET-5-INJURY-EP75':
      return 'Sérülési módosító: a max Ép legalább háromnegyede elveszett, ezért KÉ -10, TÉ -20, VÉ -10, CÉ -30.'
    default:
      return 'Sérülési módosító alkalmazva.'
  }
}

const cloneCombatant = (c: Combatant): Combatant => ({
  ...c,
  weapon: { ...c.weapon },
  armor: { ...c.armor },
})

const toSnapshot = (
  c: Combatant,
  party: Party,
  injuryStatPenalties: boolean,
): CombatantSnapshot => {
  const effective = getEffectiveCombatValues(c, { injuryStatPenalties })
  return {
  ke: effective.ke,
  te: effective.te,
  ve: effective.ve,
  ce: effective.ce,
  id: c.id,
  name: c.name,
  party,
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

/**
 * Célpont kiválasztása stratégia alapján.
 * A KM által meghatározott targetId-t előnyben részesítjük, ha az még aktív.
 * Targeting nem játékdob-alapú (Math.random), így a fizikai kocka-roller érintetlen marad.
 */
const selectTarget = (
  attacker: Combatant,
  enemies: Combatant[],
  strategy: TargetingStrategy,
  partyOf: Map<string, Party>,
  injuryStatPenalties: boolean,
): Combatant | null => {
  const eligible = enemies.filter(e => e.status === 'active')
  if (eligible.length === 0) return null

  if (attacker.targetId) {
    const assigned = eligible.find(e => e.id === attacker.targetId)
    if (assigned) return assigned
  }

  if (strategy === 'random') {
    return eligible[Math.floor(Math.random() * eligible.length)]
  }
  if (strategy === 'weakest') {
    return eligible.reduce((min, c) => {
      const r = (c.fp + c.ep) / (c.maxFp + c.maxEp)
      const m = (min.fp + min.ep) / (min.maxFp + min.maxEp)
      return r < m ? c : min
    })
  }
  if (strategy === 'strongest') {
    return eligible.reduce((max, c) =>
      getEffectiveCombatValues(c, { injuryStatPenalties }).te >
        getEffectiveCombatValues(max, { injuryStatPenalties }).te
        ? c
        : max,
    )
  }

  // Egyéni függvény: pillanatfelvételekkel hívjuk meg
  const attackerSnap = toSnapshot(attacker, partyOf.get(attacker.id)!, injuryStatPenalties)
  const enemySnaps = eligible.map((e) =>
    toSnapshot(e, partyOf.get(e.id)!, injuryStatPenalties),
  )
  const targetId = (strategy as (a: CombatantSnapshot, e: CombatantSnapshot[]) => string)(
    attackerSnap,
    enemySnaps,
  )
  return eligible.find(e => e.id === targetId) ?? eligible[0]
}

/**
 * Akció-sor összeállítása szegmensenként.
 *
 * Elveszített kezdeményezés → először csak a 10. szegmensben cselekedhet (harcrendszer.md §5).
 * Rendezés: szegmens NÖV, elveszített kezdeményezés hátul, KÉ CSÖKK azonos szegmensben.
 */
const buildActionQueue = (
  active: Combatant[],
  initiatives: Record<string, { total: number; lost: boolean }>,
): ActionSlot[] => {
  const slots: ActionSlot[] = []

  for (const c of active) {
    const cost = SEGMENT_COST[c.weapon.category]
    const { total, lost } = initiatives[c.id]
    const firstSeg = lost ? ROUND_SEGMENTS : cost

    for (let seg = firstSeg; seg <= ROUND_SEGMENTS; seg += cost) {
      slots.push({ combatantId: c.id, segment: seg, initiative: total, lostInitiative: lost })
    }
  }

  return slots.sort((a, b) => {
    if (a.segment !== b.segment) return a.segment - b.segment
    if (a.lostInitiative !== b.lostInitiative) return a.lostInitiative ? 1 : -1
    return b.initiative - a.initiative
  })
}

const groupSimultaneousSlots = (queue: ActionSlot[]): ActionSlot[][] => {
  const groups: ActionSlot[][] = []
  for (const slot of queue) {
    const last = groups[groups.length - 1]
    if (
      last &&
      last[0].segment === slot.segment &&
      last[0].initiative === slot.initiative &&
      last[0].lostInitiative === slot.lostInitiative
    ) {
      last.push(slot)
    } else {
      groups.push([slot])
    }
  }
  return groups
}

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
  const all = Array.from(combatants.values())
  const active = all.filter(c => c.status === 'active')
  const injuryStatPenalties = rules.injuryStatPenalties

  // 1. Kezdeményező dobások (harcrendszer.md §5)
  const initiatives: Record<string, { die: number; total: number; lost: boolean }> = {}
  const initiativeEntries: InitiativeEntry[] = []

  for (const c of active) {
    const lost = hadEpDamageLastRound.has(c.id)
    const die = lost ? 0 : roller(10)
    const total = lost
      ? -1
      : die + getEffectiveCombatValues(c, { injuryStatPenalties }).ke
    initiatives[c.id] = { die, total, lost }
    initiativeEntries.push({ combatantId: c.id, name: c.name, die, total, lostInitiative: lost })
  }

  initiativeEntries.sort((a, b) => {
    if (a.lostInitiative !== b.lostInitiative) return a.lostInitiative ? 1 : -1
    return b.total - a.total
  })

  // 2. Kör eleji célzási szándék → túlerő-VÉ kiszámításához
  const attackerCountPerTarget = new Map<string, number>()
  for (const attacker of active) {
    const enemies = all.filter(
      c => partyOf.get(c.id) !== partyOf.get(attacker.id) && c.status === 'active',
    )
    const target = selectTarget(attacker, enemies, strategy, partyOf, injuryStatPenalties)
    if (target) {
      const intent = getEngagementIntent(attacker, target, distances, ranged)
      if (intent.type === 'attack') {
        attackerCountPerTarget.set(target.id, (attackerCountPerTarget.get(target.id) ?? 0) + 1)
      }
    }
  }

  // 3. Túlerő miatti VÉ-levonások (harcrendszer.md §11)
  const outnumberedPenalties: Record<string, number> = {}
  for (const [targetId, count] of attackerCountPerTarget) {
    outnumberedPenalties[targetId] = OUTNUMBERED_VE_PENALTY[Math.min(count, 8)] ?? 35
  }

  // 4. Akció-sor összeállítása
  const queue = buildActionQueue(active, initiatives)

  // 5. Akciók végrehajtása
  const events: CombatEvent[] = []
  const groups = groupSimultaneousSlots(queue)
  const spentMovementThisRound = new Set<string>()

  for (const group of groups) {
    // Azonos szegmens + azonos kezdeményezés esetén egyidejű végrehajtás:
    // minden ilyen támadó cselekedhet, ha a csoport elején még aktív volt.
    const snapshot = new Map<string, Combatant>()
    for (const c of combatants.values()) snapshot.set(c.id, cloneCombatant(c))
    const distanceSnapshot = { ...distances }
    const activeAtGroupStart = new Set(
      group
        .map(s => s.combatantId)
        .filter(id => snapshot.get(id)?.status === 'active'),
    )

    for (const slot of group) {
      if (!activeAtGroupStart.has(slot.combatantId)) continue
      if (spentMovementThisRound.has(slot.combatantId)) continue
      const attacker = snapshot.get(slot.combatantId)
      if (!attacker) continue

      const party = partyOf.get(attacker.id)!
      const enemies = Array.from(snapshot.values()).filter(
        c => partyOf.get(c.id) !== party && c.status === 'active',
      )
      const target = selectTarget(attacker, enemies, strategy, partyOf, injuryStatPenalties)
      if (!target) continue
      const intent = getEngagementIntent(attacker, target, distanceSnapshot, ranged)
      if (intent.type === 'close_distance') {
        const distanceBefore = intent.distanceFeet
        const distanceAfter = Math.max(0, distanceBefore - ranged.closeDistancePerRound)
        setPairDistance(distances, attacker.id, target.id, distanceAfter)
        const actionEvent: ActionEvent = {
          eventType: 'action',
          round: roundNumber,
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
              explanation: `Zárkózás Futva szerint: ${ranged.closeDistancePerRound} láb csökkentés ebben a körben.`,
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
          round: roundNumber,
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
      const targetSnap = toSnapshot(target, partyOf.get(target.id)!, injuryStatPenalties)
      const attackerSnap = toSnapshot(attacker, party, injuryStatPenalties)

      const modifier = ruleHooks?.resolveAttackModifiers?.({
        round: roundNumber,
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
      const attackerEffective = getEffectiveCombatValues(attacker, {
        injuryStatPenalties,
      })
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
      const effectiveAttacker = {
        ...attacker,
        ...attackerEffective,
      }
      // Távolsági támadásnál CÉ ellenőrzéshez a VÉ alapja távolság+50.
      const effectiveDefense = attackMode === 'ranged'
        ? (intent.rangedDefenseBase ?? 50) + defenderVeModifier
        : effectiveVe
      if (attackMode === 'ranged') {
        appliedRules.push({
          ref: { code: 'HR-7-RANGED-DEFENSE', source: 'harcrendszer', section: '§7' },
          explanation: `Távolsági VÉ alap: távolság + 50 = ${intent.rangedDefenseBase ?? 50}.`,
        })
      }
      const event = resolveAttack(
        roundNumber,
        effectiveAttacker,
        target,
        effectiveDefense,
        slot.segment,
        roller,
        rules,
        attackerTeModifier,
        attackerCeModifier,
        attackMode,
        intent.distanceFeet ?? undefined,
        intent.rangedDefenseBase,
        appliedRules,
      )
      events.push(event)

      if (!event.hit) continue

      const liveDefender = combatants.get(target.id)
      if (!liveDefender) continue
      liveDefender.fp = Math.max(0, liveDefender.fp - event.fpLoss)
      liveDefender.ep = liveDefender.ep - event.epLoss
      liveDefender.status = deriveStatus(liveDefender.ep, liveDefender.fp)

      // Naplóban mindig a valós kör-állapotot mutatjuk.
      event.defenderFpAfter = liveDefender.fp
      event.defenderEpAfter = liveDefender.ep
      event.defenderStatusAfter = liveDefender.status
    }
  }

  // 6. Kör végi állapot-pillanatfelvétel
  const stateAfter = Array.from(combatants.values()).map((c) =>
    toSnapshot(c, partyOf.get(c.id)!, injuryStatPenalties),
  )

  return { round: roundNumber, initiatives: initiativeEntries, outnumberedPenalties, events, stateAfter }
}
