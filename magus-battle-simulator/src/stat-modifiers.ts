import type { Armor, Combatant, InjuryPenaltyCode } from './types'

const getArmorMgt = (armor: Armor): number => (Number.isFinite(armor.mgt) ? armor.mgt : 0)

const applyArmorMgt = (value: number, mgt: number): number => Math.max(0, value + mgt)

type InjuryPenalty = {
  ke: number
  te: number
  ve: number
  ce: number
  code: InjuryPenaltyCode | null
}

const NO_INJURY_PENALTY: InjuryPenalty = {
  ke: 0,
  te: 0,
  ve: 0,
  ce: 0,
  code: null,
}

const getInjuryPenalty = (
  combatant: Pick<Combatant, 'maxFp' | 'fp' | 'maxEp' | 'ep'>,
  enabled: boolean,
): InjuryPenalty => {
  if (!enabled) return NO_INJURY_PENALTY

  const maxFp = Math.max(0, combatant.maxFp)
  const maxEp = Math.max(0, combatant.maxEp)
  const fpLostRatio = maxFp > 0 ? (maxFp - combatant.fp) / maxFp : 0
  const epLostRatio = maxEp > 0 ? (maxEp - combatant.ep) / maxEp : 0

  // eletero.md §5: modifiers do not stack, strongest one applies.
  if (epLostRatio >= 0.75) {
    return { ke: -10, te: -20, ve: -10, ce: -30, code: 'ET-5-INJURY-EP75' }
  }
  if (fpLostRatio > 0.9) {
    return { ke: -10, te: -10, ve: -10, ce: -10, code: 'ET-5-INJURY-FP90' }
  }
  if (epLostRatio >= 0.5) {
    return { ke: -10, te: -10, ve: -10, ce: -10, code: 'ET-5-INJURY-EP50' }
  }
  return NO_INJURY_PENALTY
}

export const getEffectiveCombatValues = (
  combatant: Pick<Combatant, 'ke' | 'te' | 've' | 'ce' | 'armor' | 'maxFp' | 'fp' | 'maxEp' | 'ep'>,
  options: { injuryStatPenalties: boolean },
) => {
  const mgt = getArmorMgt(combatant.armor)
  const injury = getInjuryPenalty(combatant, options.injuryStatPenalties)
  return {
    mgt,
    injury,
    ke: applyArmorMgt(combatant.ke, mgt + injury.ke),
    te: applyArmorMgt(combatant.te, mgt + injury.te),
    ve: applyArmorMgt(combatant.ve, mgt + injury.ve),
    ce: applyArmorMgt(combatant.ce, mgt + injury.ce),
  }
}

