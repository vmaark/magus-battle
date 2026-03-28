import type {
  AppliedRule,
  AttackModifierContext,
  AttackModifierResult,
  CombatRuleHooks,
  CombatantSnapshot,
  RuleReference,
} from './types'

export type CombatantPredicate = (
  combatant: CombatantSnapshot,
  context: AttackModifierContext,
) => boolean

export type CombatContextPredicate = (context: AttackModifierContext) => boolean

type HookResolver = (context: AttackModifierContext) => AttackModifierResult | undefined

const createRule = (ref: RuleReference, explanation: string): AppliedRule => ({
  ref,
  explanation,
})

const add = (base: number | undefined, delta: number | undefined): number | undefined => {
  if (!delta) return base
  return (base ?? 0) + delta
}

const mergeResults = (results: Array<AttackModifierResult | undefined>): AttackModifierResult | undefined => {
  const merged: AttackModifierResult = {}
  for (const result of results) {
    if (!result) continue
    merged.attackerTeModifier = add(merged.attackerTeModifier, result.attackerTeModifier)
    merged.attackerCeModifier = add(merged.attackerCeModifier, result.attackerCeModifier)
    merged.defenderVeModifier = add(merged.defenderVeModifier, result.defenderVeModifier)
    if (result.appliedRules?.length) {
      merged.appliedRules = [...(merged.appliedRules ?? []), ...result.appliedRules]
    }
  }
  const hasAnyModifier =
    merged.attackerTeModifier !== undefined ||
    merged.attackerCeModifier !== undefined ||
    merged.defenderVeModifier !== undefined ||
    (merged.appliedRules?.length ?? 0) > 0
  return hasAnyModifier ? merged : undefined
}

export const combineModifierHooks = (...hooks: Array<CombatRuleHooks | undefined>): CombatRuleHooks => ({
  resolveAttackModifiers: (context) =>
    mergeResults(hooks.map((hook) => hook?.resolveAttackModifiers?.(context))),
})

/**
 * Segedpredicate, ha egyszeru "id alapjan jelolt harcosokra" szeretnel hatast adni.
 */
export const byCombatantIds = (ids: Iterable<string>): CombatantPredicate => {
  const idSet = new Set(ids)
  return (combatant) => idSet.has(combatant.id)
}

export const createSurpriseAttackHook = (
  isSurpriseAttack: CombatContextPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    if (!isSurpriseAttack(context)) return undefined
    return {
      attackerTeModifier: 30,
      appliedRules: [
        createRule(
          { code: 'HR-10-SURPRISE', source: 'harcrendszer', section: '§10' },
          'Meglepetésszerű támadás: a támadó TÉ-je +30.',
        ),
      ],
    }
  },
})

export const createHigherGroundHook = (
  hasHigherGround: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (hasHigherGround(context.attacker, context)) {
      attackerTeModifier += 15
      appliedRules.push(
        createRule(
          { code: 'HR-10-HIGH-GROUND', source: 'harcrendszer', section: '§10' },
          'Harc magasabbról: a támadó TÉ-je +15.',
        ),
      )
    }
    if (hasHigherGround(context.defender, context)) {
      defenderVeModifier += 5
      appliedRules.push(
        createRule(
          { code: 'HR-10-HIGH-GROUND', source: 'harcrendszer', section: '§10' },
          'Harc magasabbról: a védő VÉ-je +5.',
        ),
      )
    }

    if (attackerTeModifier === 0 && defenderVeModifier === 0) return undefined
    return { attackerTeModifier, defenderVeModifier, appliedRules }
  },
})

export const createMountedCombatHook = (
  isMountedCombatant: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isMountedCombatant(context.attacker, context)) {
      attackerTeModifier += 20
      appliedRules.push(
        createRule(
          { code: 'HR-10-MOUNTED', source: 'harcrendszer', section: '§10' },
          'Harc mozgó lóról: a támadó TÉ-je +20.',
        ),
      )
    }
    if (isMountedCombatant(context.defender, context)) {
      defenderVeModifier += 10
      appliedRules.push(
        createRule(
          { code: 'HR-10-MOUNTED', source: 'harcrendszer', section: '§10' },
          'Harc mozgó lóról: a védő VÉ-je +10.',
        ),
      )
    }

    if (attackerTeModifier === 0 && defenderVeModifier === 0) return undefined
    return { attackerTeModifier, defenderVeModifier, appliedRules }
  },
})

export const createConstrainedCombatHook = (
  isConstrained: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isConstrained(context.attacker, context)) {
      attackerTeModifier -= 10
      appliedRules.push(
        createRule(
          { code: 'HR-10-CONSTRAINED', source: 'harcrendszer', section: '§10' },
          'Harc helyhez kötve: a támadó TÉ-je -10.',
        ),
      )
    }
    if (isConstrained(context.defender, context)) {
      defenderVeModifier -= 10
      appliedRules.push(
        createRule(
          { code: 'HR-10-CONSTRAINED', source: 'harcrendszer', section: '§10' },
          'Harc helyhez kötve: a védő VÉ-je -10.',
        ),
      )
    }

    if (attackerTeModifier === 0 && defenderVeModifier === 0) return undefined
    return { attackerTeModifier, defenderVeModifier, appliedRules }
  },
})

export const createChargeHook = (
  isCharging: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let attackerCeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isCharging(context.attacker, context)) {
      attackerTeModifier += 20
      attackerCeModifier -= 20
      appliedRules.push(
        createRule(
          { code: 'HR-10-CHARGE', source: 'harcrendszer', section: '§10' },
          'Roham: a támadó TÉ-je +20 és CÉ-je -20.',
        ),
      )
    }
    if (isCharging(context.defender, context)) {
      defenderVeModifier -= 20
      appliedRules.push(
        createRule(
          { code: 'HR-10-CHARGE', source: 'harcrendszer', section: '§10' },
          'Roham: a védő VÉ-je -20.',
        ),
      )
    }

    if (attackerTeModifier === 0 && attackerCeModifier === 0 && defenderVeModifier === 0) {
      return undefined
    }
    return { attackerTeModifier, attackerCeModifier, defenderVeModifier, appliedRules }
  },
})

export const createBackAttackHook = (
  isBackAttack: CombatContextPredicate,
  options: { shieldVeBonus?: number } = {},
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    if (!isBackAttack(context)) return undefined
    const shieldVeBonus = options.shieldVeBonus ?? 0
    const defenderVeModifier = -(Math.max(0, context.defender.weapon.ve) + Math.max(0, shieldVeBonus))
    return {
      defenderVeModifier,
      appliedRules: [
        createRule(
          { code: 'HR-10-BACK-ATTACK', source: 'harcrendszer', section: '§10' },
          'Támadás hátulról: a védő elveszíti a fegyver és pajzs VÉ-bónuszait.',
        ),
      ],
    }
  },
})

export const createSideAttackHook = (
  isSideAttack: CombatContextPredicate,
  options: { shieldVeBonus?: number; preferShieldLoss?: boolean } = {},
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    if (!isSideAttack(context)) return undefined

    const shieldVeBonus = Math.max(0, options.shieldVeBonus ?? 0)
    const weaponVe = Math.max(0, context.defender.weapon.ve)
    const loss = options.preferShieldLoss && shieldVeBonus > 0 ? shieldVeBonus : Math.max(weaponVe, shieldVeBonus)

    if (loss <= 0) return undefined

    return {
      defenderVeModifier: -loss,
      appliedRules: [
        createRule(
          { code: 'HR-10-SIDE-ATTACK', source: 'harcrendszer', section: '§10' },
          'Támadás oldalról/félhátulról: a védő elveszíti fegyver vagy pajzs VÉ-bónuszát.',
        ),
      ],
    }
  },
})

export const createBlindOrDarknessHook = (
  isBlindOrInDarkness: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let attackerCeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isBlindOrInDarkness(context.attacker, context)) {
      attackerTeModifier -= 60
      attackerCeModifier -= 150
      appliedRules.push(
        createRule(
          { code: 'HR-10-BLIND', source: 'harcrendszer', section: '§10' },
          'Harc vakon/vaksötétben: a támadó TÉ-je -60 és CÉ-je -150.',
        ),
      )
    }
    if (isBlindOrInDarkness(context.defender, context)) {
      defenderVeModifier -= 60
      appliedRules.push(
        createRule(
          { code: 'HR-10-BLIND', source: 'harcrendszer', section: '§10' },
          'Harc vakon/vaksötétben: a védő VÉ-je -60.',
        ),
      )
    }

    if (attackerTeModifier === 0 && attackerCeModifier === 0 && defenderVeModifier === 0) {
      return undefined
    }
    return { attackerTeModifier, attackerCeModifier, defenderVeModifier, appliedRules }
  },
})

export const createInvisibleOpponentHook = (
  cannotSeeOpponent: CombatContextPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    if (!cannotSeeOpponent(context)) return undefined
    return {
      attackerTeModifier: -40,
      attackerCeModifier: -75,
      appliedRules: [
        createRule(
          { code: 'HR-10-INVISIBLE-OPPONENT', source: 'harcrendszer', section: '§10' },
          'Láthatatlan ellenfél ellen: a támadó TÉ-je -40 és CÉ-je -75.',
        ),
      ],
    }
  },
})

export const createFearHook = (
  isUnderFear: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isUnderFear(context.attacker, context)) {
      attackerTeModifier -= 20
      appliedRules.push(
        createRule(
          { code: 'HR-10-FEAR', source: 'harcrendszer', section: '§10' },
          'Harc félelem hatása alatt: a támadó TÉ-je -20.',
        ),
      )
    }
    if (isUnderFear(context.defender, context)) {
      defenderVeModifier += 10
      appliedRules.push(
        createRule(
          { code: 'HR-10-FEAR', source: 'harcrendszer', section: '§10' },
          'Harc félelem hatása alatt: a védő VÉ-je +10.',
        ),
      )
    }

    if (attackerTeModifier === 0 && defenderVeModifier === 0) return undefined
    return { attackerTeModifier, defenderVeModifier, appliedRules }
  },
})

export const createHatredHook = (
  isUnderHatred: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isUnderHatred(context.attacker, context)) {
      attackerTeModifier += 5
      appliedRules.push(
        createRule(
          { code: 'HR-10-HATRED', source: 'harcrendszer', section: '§10' },
          'Harc gyűlölettel eltelve: a támadó TÉ-je +5.',
        ),
      )
    }
    if (isUnderHatred(context.defender, context)) {
      defenderVeModifier -= 10
      appliedRules.push(
        createRule(
          { code: 'HR-10-HATRED', source: 'harcrendszer', section: '§10' },
          'Harc gyűlölettel eltelve: a védő VÉ-je -10.',
        ),
      )
    }

    if (attackerTeModifier === 0 && defenderVeModifier === 0) return undefined
    return { attackerTeModifier, defenderVeModifier, appliedRules }
  },
})

export const createStunnedHook = (
  isStunned: CombatantPredicate,
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    let attackerTeModifier = 0
    let attackerCeModifier = 0
    let defenderVeModifier = 0
    const appliedRules: AppliedRule[] = []

    if (isStunned(context.attacker, context)) {
      attackerTeModifier -= 20
      attackerCeModifier -= 30
      appliedRules.push(
        createRule(
          { code: 'HR-10-STUNNED', source: 'harcrendszer', section: '§10' },
          'Harc kábultan: a támadó TÉ-je -20 és CÉ-je -30.',
        ),
      )
    }
    if (isStunned(context.defender, context)) {
      defenderVeModifier -= 10
      appliedRules.push(
        createRule(
          { code: 'HR-10-STUNNED', source: 'harcrendszer', section: '§10' },
          'Harc kábultan: a védő VÉ-je -10.',
        ),
      )
    }

    if (attackerTeModifier === 0 && attackerCeModifier === 0 && defenderVeModifier === 0) {
      return undefined
    }
    return { attackerTeModifier, attackerCeModifier, defenderVeModifier, appliedRules }
  },
})

export const createDefensiveFightingHook = (
  getDefensiveMode: (combatant: CombatantSnapshot, context: AttackModifierContext) => 'none' | 'open' | 'wall' | 'split',
): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => {
    const mode = getDefensiveMode(context.defender, context)
    if (mode === 'none') return undefined

    const bonus = mode === 'open' ? 40 : mode === 'wall' ? 25 : 10
    const label = mode === 'open' ? 'szabad térben' : mode === 'wall' ? 'falhoz szorítva' : 'megosztott figyelemmel'

    return {
      defenderVeModifier: bonus,
      appliedRules: [
        createRule(
          { code: 'HR-10-DEFENSIVE', source: 'harcrendszer', section: '§10' },
          `Védekező harc (${label}): a védő VÉ-je +${bonus}.`,
        ),
      ],
    }
  },
})

/**
 * Szintaktikai cukor: több resolverbol egyetlen hook.
 * Akkor hasznos, ha nem minden reszt a fenti gyari fuggvenyekkel epitesz.
 */
export const createModifierHook = (...resolvers: HookResolver[]): CombatRuleHooks => ({
  resolveAttackModifiers: (context) => mergeResults(resolvers.map((resolver) => resolver(context))),
})
