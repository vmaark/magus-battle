/**
 * Egy teljes harci kör végrehajtása.
 * Szabályok: harcrendszer.md §1, §5, §11, §12
 */

import type {
  Combatant,
  RoundResult,
  InitiativeEntry,
  AttackEvent,
  DiceRoller,
  TargetingStrategy,
  OptionalRules,
  CombatantSnapshot,
  CombatRuleHooks,
  AppliedRule,
} from './types'
import { SEGMENT_COST, ROUND_SEGMENTS } from './types'
import { deriveStatus, resolveAttack } from './combat'

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

const cloneCombatant = (c: Combatant): Combatant => ({
  ...c,
  weapon: { ...c.weapon },
  armor: { ...c.armor },
})

const toSnapshot = (c: Combatant, party: 'a' | 'b'): CombatantSnapshot => ({
  id: c.id,
  name: c.name,
  party,
  ke: c.ke,
  te: c.te,
  ve: c.ve,
  ce: c.ce,
  fp: c.fp,
  maxFp: c.maxFp,
  ep: c.ep,
  maxEp: c.maxEp,
  status: c.status,
  weapon: c.weapon,
  armor: c.armor,
  targetId: c.targetId,
})

/**
 * Célpont kiválasztása stratégia alapján.
 * A KM által meghatározott targetId-t előnyben részesítjük, ha az még aktív.
 * Targeting nem játékdob-alapú (Math.random), így a fizikai kocka-roller érintetlen marad.
 */
const selectTarget = (
  attacker: Combatant,
  enemies: Combatant[],
  strategy: TargetingStrategy,
  partyOf: Map<string, 'a' | 'b'>,
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
    return eligible.reduce((max, c) => (c.te > max.te ? c : max))
  }

  // Egyéni függvény: pillanatfelvételekkel hívjuk meg
  const attackerSnap = toSnapshot(attacker, partyOf.get(attacker.id)!)
  const enemySnaps = eligible.map(e => toSnapshot(e, partyOf.get(e.id)!))
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
  partyOf: Map<string, 'a' | 'b'>,
  hadEpDamageLastRound: Set<string>,
  roller: DiceRoller,
  strategy: TargetingStrategy,
  rules: OptionalRules,
  ruleHooks?: CombatRuleHooks,
): RoundResult => {
  const all = Array.from(combatants.values())
  const active = all.filter(c => c.status === 'active')

  // 1. Kezdeményező dobások (harcrendszer.md §5)
  const initiatives: Record<string, { die: number; total: number; lost: boolean }> = {}
  const initiativeEntries: InitiativeEntry[] = []

  for (const c of active) {
    const lost = hadEpDamageLastRound.has(c.id)
    const die = lost ? 0 : roller(10)
    const total = lost ? -1 : die + c.ke
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
    const target = selectTarget(attacker, enemies, strategy, partyOf)
    if (target) {
      attackerCountPerTarget.set(target.id, (attackerCountPerTarget.get(target.id) ?? 0) + 1)
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
  const events: AttackEvent[] = []
  const groups = groupSimultaneousSlots(queue)

  for (const group of groups) {
    // Azonos szegmens + azonos kezdeményezés esetén egyidejű végrehajtás:
    // minden ilyen támadó cselekedhet, ha a csoport elején még aktív volt.
    const snapshot = new Map<string, Combatant>()
    for (const c of combatants.values()) snapshot.set(c.id, cloneCombatant(c))
    const activeAtGroupStart = new Set(
      group
        .map(s => s.combatantId)
        .filter(id => snapshot.get(id)?.status === 'active'),
    )

    for (const slot of group) {
      if (!activeAtGroupStart.has(slot.combatantId)) continue
      const attacker = snapshot.get(slot.combatantId)
      if (!attacker) continue

      const party = partyOf.get(attacker.id)!
      const enemies = Array.from(snapshot.values()).filter(
        c => partyOf.get(c.id) !== party && c.status === 'active',
      )
      const target = selectTarget(attacker, enemies, strategy, partyOf)
      if (!target) continue

      const penalty = outnumberedPenalties[target.id] ?? 0
      const targetSnap = toSnapshot(target, partyOf.get(target.id)!)
      const attackerSnap = toSnapshot(attacker, party)

      const modifier = ruleHooks?.resolveAttackModifiers?.({
        round: roundNumber,
        segment: slot.segment,
        attacker: attackerSnap,
        defender: targetSnap,
      })
      const attackerTeModifier = modifier?.attackerTeModifier ?? 0
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

      const effectiveVe = target.ve - penalty + defenderVeModifier
      const event = resolveAttack(
        roundNumber,
        attacker,
        target,
        effectiveVe,
        slot.segment,
        roller,
        rules,
        attackerTeModifier,
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
  const stateAfter = Array.from(combatants.values()).map(c =>
    toSnapshot(c, partyOf.get(c.id)!),
  )

  return { round: roundNumber, initiatives: initiativeEntries, outnumberedPenalties, events, stateAfter }
}
