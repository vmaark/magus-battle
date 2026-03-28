/**
 * Egyetlen támadás feloldása.
 * Szabályok: harcrendszer.md §6–9, eletero.md §1–2, §5
 */

import type {
  AttackMode,
  Combatant,
  AttackEvent,
  DiceRoller,
  OptionalRules,
  AppliedRule,
} from './types'
import { deriveStatus as deriveStatusCore, resolveAttackCore } from './rules/attack'

export const deriveStatus = deriveStatusCore

/**
 * Egy támadás feloldása a támadótól a védő felé.
 *
 * @param effectiveVe  Védő VÉ-je a túlerő-levonás után
 * @param segment      Melyik szegmensben történik a csapás (naplózáshoz)
 */
export const resolveAttack = (
  round: number,
  attacker: Combatant,
  defender: Combatant,
  effectiveVe: number,
  segment: number,
  roller: DiceRoller,
  rules: OptionalRules,
  attackerTeModifier = 0,
  attackerCeModifier = 0,
  attackMode: AttackMode = 'melee',
  distanceFeet?: number,
  rangedDefenseBase?: number,
  externalRules: AppliedRule[] = [],
): AttackEvent => {
  const outcome = resolveAttackCore(
    attacker,
    defender,
    effectiveVe,
    roller,
    rules,
    attackerTeModifier,
    attackerCeModifier,
    attackMode,
    externalRules,
  )

  return {
    eventType: 'attack',
    round,
    segment,
    attackerId: attacker.id,
    attackerName: attacker.name,
    attackerWeapon: attacker.weapon,
    defenderId: defender.id,
    defenderName: defender.name,
    roll: outcome.roll,
    attackTotal: outcome.attackTotal,
    attackerTeTotal: outcome.attackerTeTotal,
    attackerCeTotal: outcome.attackerCeTotal,
    attackMode,
    defenderVe: effectiveVe,
    hit: outcome.hit,
    automaticHit: outcome.automaticHit,
    automaticFatal: outcome.automaticFatal,
    criticalHit: outcome.criticalHit,
    criticalMiss: outcome.criticalMiss,
    overthit: outcome.overthit,
    rawDamage: outcome.rawDamage,
    damage: outcome.damage,
    fpLoss: outcome.fpLoss,
    epLoss: outcome.epLoss,
    defenderFpAfter: outcome.defenderFpAfter,
    defenderEpAfter: outcome.defenderEpAfter,
    defenderStatusAfter: outcome.defenderStatusAfter,
    rangedDefenseBase,
    distanceFeet,
    appliedRules: outcome.appliedRules,
  }
}
