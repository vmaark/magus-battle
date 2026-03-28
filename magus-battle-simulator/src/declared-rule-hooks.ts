import type { CombatRuleHooks } from './types'
import {
  combineModifierHooks,
  createBackAttackHook,
  createBlindOrDarknessHook,
  createChargeHook,
  createConstrainedCombatHook,
  createDefensiveFightingHook,
  createFearHook,
  createHatredHook,
  createHigherGroundHook,
  createInvisibleOpponentHook,
  createSideAttackHook,
  createStunnedHook,
  createSurpriseAttackHook,
} from './predefined-rule-hooks'

export type DeclaredCombatRuleId =
  | 'meglepetesszeru_tamadas'
  | 'roham'
  | 'tamadas_hatulrol'
  | 'tamadas_oldalrol'
  | 'harc_magasabbrol'
  | 'harc_helyhez_kotve'
  | 'harc_vakon_vaksotetben'
  | 'harc_lathatatlan_ellenfellel'
  | 'harc_felelem_alatt'
  | 'harc_gyulolettel'
  | 'harc_kabultan'
  | 'vedekezo_harc_szabad_ter'
  | 'vedekezo_harc_falhoz_szoritva'
  | 'vedekezo_harc_megosztott_figyelem'

export type DeclaredCombatRuleOption = {
  id: DeclaredCombatRuleId
  label: string
}

export const DECLARED_COMBAT_RULE_OPTIONS: DeclaredCombatRuleOption[] = [
  { id: 'meglepetesszeru_tamadas', label: 'Meglepetésszerű támadás' },
  { id: 'roham', label: 'Roham' },
  { id: 'tamadas_hatulrol', label: 'Támadás hátulról' },
  { id: 'tamadas_oldalrol', label: 'Támadás oldalról / félhátulról' },
  { id: 'harc_magasabbrol', label: 'Harc magasabbról' },
  { id: 'harc_helyhez_kotve', label: 'Harc helyhez kötve' },
  { id: 'harc_vakon_vaksotetben', label: 'Harc vakon / vaksötétben' },
  { id: 'harc_lathatatlan_ellenfellel', label: 'Harc láthatatlan ellenféllel' },
  { id: 'harc_felelem_alatt', label: 'Harc félelem hatása alatt' },
  { id: 'harc_gyulolettel', label: 'Harc gyűlölettel eltelve' },
  { id: 'harc_kabultan', label: 'Harc kábultan' },
  { id: 'vedekezo_harc_szabad_ter', label: 'Védekező harc (szabad tér)' },
  { id: 'vedekezo_harc_falhoz_szoritva', label: 'Védekező harc (falhoz szorítva)' },
  { id: 'vedekezo_harc_megosztott_figyelem', label: 'Védekező harc (megosztott figyelem)' },
]

export type DeclaredCombatRule = {
  id: string
  sourceId: string
  ruleId: DeclaredCombatRuleId
}

const buildRuleSets = (declarations: DeclaredCombatRule[]): Map<DeclaredCombatRuleId, Set<string>> => {
  const map = new Map<DeclaredCombatRuleId, Set<string>>()
  for (const decl of declarations) {
    if (!decl.sourceId) continue
    const current = map.get(decl.ruleId) ?? new Set<string>()
    current.add(decl.sourceId)
    map.set(decl.ruleId, current)
  }
  return map
}

const hasRuleForSource = (
  sets: Map<DeclaredCombatRuleId, Set<string>>,
  ruleId: DeclaredCombatRuleId,
  sourceId: string,
): boolean => (sets.get(ruleId)?.has(sourceId) ?? false)

/**
 * Deklarációkból állít elő egyetlen CombatRuleHooks objektumot.
 *
 * A deklaráció szemantikája:
 * - "sourceId": a kiválasztott harcosra vonatkozik.
 * - Bizonyos szabályok irányérzékenyek (pl. hátulról támadás),
 *   mások állapot-jellegűek és mindkét szerepben érvényesülhetnek ugyanarra a harcosra (pl. rohamozó védelme gyengébb).
 */
export const createDeclaredCombatRuleHooks = (
  declarations: DeclaredCombatRule[],
): CombatRuleHooks | undefined => {
  if (!declarations.length) return undefined
  const sets = buildRuleSets(declarations)

  const hooks: CombatRuleHooks[] = [
    createSurpriseAttackHook((ctx) =>
      hasRuleForSource(sets, 'meglepetesszeru_tamadas', ctx.attacker.id),
    ),
    createBackAttackHook((ctx) => hasRuleForSource(sets, 'tamadas_hatulrol', ctx.attacker.id)),
    createSideAttackHook((ctx) => hasRuleForSource(sets, 'tamadas_oldalrol', ctx.attacker.id)),
    createChargeHook((combatant) => hasRuleForSource(sets, 'roham', combatant.id)),
    createHigherGroundHook((combatant) => hasRuleForSource(sets, 'harc_magasabbrol', combatant.id)),
    createConstrainedCombatHook((combatant) => hasRuleForSource(sets, 'harc_helyhez_kotve', combatant.id)),
    createBlindOrDarknessHook((combatant) =>
      hasRuleForSource(sets, 'harc_vakon_vaksotetben', combatant.id),
    ),
    createInvisibleOpponentHook((ctx) =>
      hasRuleForSource(sets, 'harc_lathatatlan_ellenfellel', ctx.attacker.id),
    ),
    createFearHook((combatant) => hasRuleForSource(sets, 'harc_felelem_alatt', combatant.id)),
    createHatredHook((combatant) => hasRuleForSource(sets, 'harc_gyulolettel', combatant.id)),
    createStunnedHook((combatant) => hasRuleForSource(sets, 'harc_kabultan', combatant.id)),
    createDefensiveFightingHook((combatant, ctx) => {
      if (combatant.id !== ctx.defender.id) return 'none'
      if (hasRuleForSource(sets, 'vedekezo_harc_szabad_ter', combatant.id)) return 'open'
      if (hasRuleForSource(sets, 'vedekezo_harc_falhoz_szoritva', combatant.id)) return 'wall'
      if (hasRuleForSource(sets, 'vedekezo_harc_megosztott_figyelem', combatant.id))
        return 'split'
      return 'none'
    }),
  ]

  return combineModifierHooks(...hooks)
}
