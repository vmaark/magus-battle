import type { AttackMode, AppliedRule, Combatant, CombatantStatus, DiceRoller, OptionalRules } from '../types'
import { rollDamage, rollDamageWithArcherRule, rollK100 } from '../dice'

const OVERTHIT_THRESHOLD = 50

export type AttackResolution = {
  roll: number
  attackTotal: number
  attackerTeTotal: number
  attackerCeTotal: number
  hit: boolean
  automaticHit: boolean
  automaticFatal: boolean
  criticalHit: boolean
  criticalMiss: boolean
  overthit: boolean
  rawDamage: number
  damage: number
  fpLoss: number
  epLoss: number
  defenderFpAfter: number
  defenderEpAfter: number
  defenderStatusAfter: CombatantStatus
  appliedRules: AppliedRule[]
}

/** Levezetett állapot Ép és Fp alapján. */
export const deriveStatus = (ep: number, fp: number): CombatantStatus => {
  if (ep < 0) return 'dead'
  if (ep === 0) return 'unconscious'
  if (fp <= 0) return 'unconscious'
  return 'active'
}

export const resolveAttackCore = (
  attacker: Combatant,
  defender: Combatant,
  effectiveVe: number,
  roller: DiceRoller,
  rules: OptionalRules,
  attackerTeModifier = 0,
  attackerCeModifier = 0,
  attackMode: AttackMode = 'melee',
  externalRules: AppliedRule[] = [],
): AttackResolution => {
  const appliedRules: AppliedRule[] = [...externalRules]

  if (defender.ep === 0) {
    appliedRules.push({
      ref: { code: 'HR-9-MORAL-FOLLOWUP', source: 'harcrendszer', section: '§9' },
      explanation: 'A célpont 0 Ép állapotban van, ezért a további támadások dobás nélkül halálosak.',
    })
    const epLoss = 1
    const fpLoss = defender.fp
    return {
      roll: 0,
      attackTotal: attacker.te + attackerTeModifier,
      attackerTeTotal: attacker.te + attackerTeModifier,
      attackerCeTotal: attacker.ce + attackerCeModifier,
      hit: true,
      automaticHit: true,
      automaticFatal: true,
      criticalHit: false,
      criticalMiss: false,
      overthit: false,
      rawDamage: 0,
      damage: 0,
      fpLoss,
      epLoss,
      defenderFpAfter: 0,
      defenderEpAfter: defender.ep - epLoss,
      defenderStatusAfter: 'dead',
      appliedRules,
    }
  }

  const roll = rollK100(roller)
  const criticalHit = roll === 100
  const criticalMiss = roll === 1
  const attackerTeTotal = attacker.te + attackerTeModifier
  const attackerCeTotal = attacker.ce + attackerCeModifier
  const offenseTotal = attackMode === 'ranged' ? attackerCeTotal : attackerTeTotal
  const attackTotal = roll + offenseTotal
  const hit = criticalHit || (!criticalMiss && attackTotal >= effectiveVe)

  if (attackerTeModifier !== 0) {
    appliedRules.push({
      ref: { code: 'HR-10-COMBAT-MOD', source: 'harcrendszer', section: '§10' },
      explanation: `Harci helyzetmódosító alkalmazva: támadó TÉ ${attackerTeModifier >= 0 ? '+' : ''}${attackerTeModifier}.`,
    })
  }
  if (attackerCeModifier !== 0) {
    appliedRules.push({
      ref: { code: 'HR-10-COMBAT-MOD', source: 'harcrendszer', section: '§10' },
      explanation: `Harci helyzetmódosító alkalmazva: támadó CÉ ${attackerCeModifier >= 0 ? '+' : ''}${attackerCeModifier}.`,
    })
  }
  if (criticalMiss) {
    appliedRules.push({
      ref: { code: 'HR-6-CRIT-01', source: 'harcrendszer', section: '§6' },
      explanation: '01-es dobás: automatikus kudarc.',
    })
  }

  if (!hit) {
    return {
      roll,
      attackTotal,
      attackerTeTotal,
      attackerCeTotal,
      hit: false,
      automaticHit: false,
      automaticFatal: false,
      criticalHit: false,
      criticalMiss,
      overthit: false,
      rawDamage: 0,
      damage: 0,
      fpLoss: 0,
      epLoss: 0,
      defenderFpAfter: defender.fp,
      defenderEpAfter: defender.ep,
      defenderStatusAfter: defender.status,
      appliedRules,
    }
  }

  const overthit = attackTotal >= effectiveVe + OVERTHIT_THRESHOLD
  const rangedArcherRule = attackMode === 'ranged'
  const archerDetail = rangedArcherRule
    ? rollDamageWithArcherRule(attacker.weapon.damage, roller)
    : null
  const rawDamage = archerDetail ? archerDetail.total : rollDamage(attacker.weapon.damage, roller)
  if (archerDetail?.triggered) {
    appliedRules.push({
      ref: { code: 'HR-7-ARCHER-RULE', source: 'harcrendszer', section: '§7' },
      explanation:
        'Íjász szabály: maximumot dobó sebzéskockára újradobás történt, és az eredmények összeadódtak.',
    })
  }
  const sfe = criticalHit ? 0 : defender.armor.sfe
  const effectiveDamage = Math.max(0, rawDamage - sfe)
  const bonusEp = criticalHit ? 3 : 0
  if (!criticalHit && effectiveDamage === 0) {
    appliedRules.push({
      ref: { code: 'HR-12-SFE-ABSORB', source: 'harcrendszer', section: '§12' },
      explanation: 'A páncél SFÉ-je teljesen felfogta a sebzést (0 nettó sebzés).',
    })
  }
  if (criticalHit) {
    appliedRules.push({
      ref: { code: 'HR-6-CRIT-00', source: 'harcrendszer', section: '§6' },
      explanation: '00-as dobás: automatikus találat, SFÉ nem érvényesül, és +3 Ép bónuszsebzés jár.',
    })
  }

  let fpLoss: number
  let epLoss: number

  if (overthit || defender.fp <= 0) {
    if (overthit) {
      appliedRules.push({
        ref: { code: 'HR-9-OVERHIT', source: 'harcrendszer', section: '§9' },
        explanation: 'Túlütés történt (+50 VÉ fölött), ezért a sebzés közvetlenül Ép-t csökkent.',
      })
    } else {
      appliedRules.push({
        ref: { code: 'ET-2-FP-0', source: 'eletero', section: '§2' },
        explanation: 'A védő Fp-je 0, ezért a további sebzés közvetlenül Ép-ből vonódik.',
      })
    }
    epLoss = effectiveDamage + bonusEp
    fpLoss = Math.min(defender.fp, epLoss * 2)
  } else {
    const fpAbsorb = Math.min(defender.fp, effectiveDamage)
    const overflow = effectiveDamage - fpAbsorb
    let directEp = overflow + bonusEp
    if (rules.mandatoryEpFromFp) directEp += Math.floor(fpAbsorb / 5)
    epLoss = directEp
    fpLoss = Math.min(defender.fp, fpAbsorb + epLoss * 2)
    if (rules.mandatoryEpFromFp && Math.floor(fpAbsorb / 5) > 0) {
      appliedRules.push({
        ref: { code: 'ET-5-MANDATORY-EP', source: 'eletero', section: '§5' },
        explanation: `Kötelező Ép veszteség: ${Math.floor(fpAbsorb / 5)} Ép (minden 5 Fp után 1 Ép).`,
      })
    }
  }

  if (defender.isPlayerCharacter && defender.ep > 0 && defender.ep - epLoss < 0) {
    epLoss = defender.ep
    if (overthit || defender.fp <= 0) {
      fpLoss = Math.min(defender.fp, epLoss * 2)
    } else {
      const fpAbsorb = Math.min(defender.fp, effectiveDamage)
      fpLoss = Math.min(defender.fp, fpAbsorb + epLoss * 2)
    }
  }

  const newFp = Math.max(0, defender.fp - fpLoss)
  const newEp = defender.ep - epLoss

  return {
    roll,
    attackTotal,
    attackerTeTotal,
    attackerCeTotal,
    hit: true,
    automaticHit: false,
    automaticFatal: false,
    criticalHit,
    criticalMiss: false,
    overthit,
    rawDamage,
    damage: effectiveDamage,
    fpLoss,
    epLoss,
    defenderFpAfter: newFp,
    defenderEpAfter: newEp,
    defenderStatusAfter: deriveStatus(newEp, newFp),
    appliedRules,
  }
}
