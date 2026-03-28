import type {
  Combatant,
  CombatantSnapshot,
  DistanceKey,
  DistanceMap,
  InjuryPenaltyCode,
  Party,
  TargetingStrategy,
} from '../types'
import { ROUND_SEGMENTS, SEGMENT_COST } from '../types'
import { getEffectiveCombatValues } from '../stat-modifiers'
import type { RangedRoundSettings } from './types'

export const OUTNUMBERED_VE_PENALTY: Record<number, number> = {
  1: 0,
  2: 5,
  3: 10,
  4: 15,
  5: 20,
  6: 25,
  7: 30,
  8: 35,
}

export type ActionSlot = {
  combatantId: string
  segment: number
  initiative: number
  lostInitiative: boolean
}

export type EngagementIntent =
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

export const distanceKey = (attackerId: string, defenderId: string): DistanceKey =>
  `${attackerId}->${defenderId}`

export const isRangedWeapon = (weapon: Combatant['weapon']): boolean =>
  weapon.attackMode === 'ranged' || weapon.ce > 0

export const getWeaponRange = (weapon: Combatant['weapon']): number | null => {
  if (Number.isFinite(weapon.rangeFeet)) return Math.max(0, Number(weapon.rangeFeet))
  return null
}

export const getPairDistance = (
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

export const setPairDistance = (
  distances: DistanceMap,
  aId: string,
  bId: string,
  value: number,
): DistanceMap => {
  const normalized = Math.max(0, Math.floor(value))
  return {
    ...distances,
    [distanceKey(aId, bId)]: normalized,
    [distanceKey(bId, aId)]: normalized,
  }
}

export const getEngagementIntent = (
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

export const describeInjuryPenalty = (code: InjuryPenaltyCode): string => {
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

export const cloneCombatant = (c: Combatant): Combatant => ({
  ...c,
  weapon: { ...c.weapon },
  armor: { ...c.armor },
})

export const toSnapshot = (
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

export const selectTarget = (
  attacker: Combatant,
  enemies: Combatant[],
  strategy: TargetingStrategy,
  partyOf: Record<string, Party>,
  injuryStatPenalties: boolean,
  targetRng: () => number,
): Combatant | null => {
  const eligible = enemies.filter(e => e.status === 'active')
  if (eligible.length === 0) return null

  if (attacker.targetId) {
    const assigned = eligible.find(e => e.id === attacker.targetId)
    if (assigned) return assigned
  }

  if (strategy === 'random') {
    const rolled = targetRng()
    const normalized = Number.isFinite(rolled) ? rolled : 0
    const index = Math.min(eligible.length - 1, Math.max(0, Math.floor(normalized * eligible.length)))
    return eligible[index]
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

  const attackerSnap = toSnapshot(attacker, partyOf[attacker.id], injuryStatPenalties)
  const enemySnaps = eligible.map(e => toSnapshot(e, partyOf[e.id], injuryStatPenalties))
  const targetId = strategy(attackerSnap, enemySnaps)
  return eligible.find(e => e.id === targetId) ?? eligible[0]
}

export const buildActionQueue = (
  active: Combatant[],
  initiatives: Record<string, { total: number; lost: boolean }>,
): ActionSlot[] => {
  const slots: ActionSlot[] = []

  for (const c of active) {
    const explicitTime = c.weapon.time
    const cost =
      Number.isFinite(explicitTime) && Number(explicitTime) > 0
        ? Math.floor(Number(explicitTime))
        : SEGMENT_COST[c.weapon.category]
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

export const groupSimultaneousSlots = (queue: ActionSlot[]): ActionSlot[][] => {
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

export const computeOutnumberedPenalties = (
  active: Combatant[],
  all: Combatant[],
  partyOf: Record<string, Party>,
  strategy: TargetingStrategy,
  distances: DistanceMap,
  ranged: RangedRoundSettings,
  injuryStatPenalties: boolean,
  targetRng: () => number,
): Record<string, number> => {
  const attackerCountPerTarget = new Map<string, number>()
  for (const attacker of active) {
    const enemies = all.filter(c => partyOf[c.id] !== partyOf[attacker.id] && c.status === 'active')
    const target = selectTarget(attacker, enemies, strategy, partyOf, injuryStatPenalties, targetRng)
    if (!target) continue
    const intent = getEngagementIntent(attacker, target, distances, ranged)
    if (intent.type === 'attack') {
      attackerCountPerTarget.set(target.id, (attackerCountPerTarget.get(target.id) ?? 0) + 1)
    }
  }

  const outnumberedPenalties: Record<string, number> = {}
  for (const [targetId, count] of attackerCountPerTarget) {
    outnumberedPenalties[targetId] = OUTNUMBERED_VE_PENALTY[Math.min(count, 8)] ?? 35
  }
  return outnumberedPenalties
}
