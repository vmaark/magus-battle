export * from './types'
export * from './equipment-types'
export { MAGUS_EQUIPMENT_DATA, getWeaponByName, getArmorByName, getShieldByName } from './equipment-data'
export { defaultRoller, rollK100, rollDamage } from './dice'
export { resolveAttack, deriveStatus } from './combat'
export { createEncounter } from './encounter'
export { resolveAttackCore } from './rules/attack'
export { resolveRoundPure } from './rules/round-engine'
export type { RoundState, RoundContext, RoundTransition, RangedRoundSettings } from './rules/types'
export {
  buildActionQueue,
  computeOutnumberedPenalties,
  getEngagementIntent,
  groupSimultaneousSlots,
  selectTarget,
} from './rules/round-helpers'
export {
  byCombatantIds,
  combineModifierHooks,
  createModifierHook,
  createSurpriseAttackHook,
  createHigherGroundHook,
  createMountedCombatHook,
  createConstrainedCombatHook,
  createChargeHook,
  createBackAttackHook,
  createSideAttackHook,
  createBlindOrDarknessHook,
  createInvisibleOpponentHook,
  createFearHook,
  createHatredHook,
  createStunnedHook,
  createDefensiveFightingHook,
} from './predefined-rule-hooks'
export type { CombatantPredicate, CombatContextPredicate } from './predefined-rule-hooks'
export { createDeclaredCombatRuleHooks, DECLARED_COMBAT_RULE_OPTIONS } from './declared-rule-hooks'
export type { DeclaredCombatRule, DeclaredCombatRuleId, DeclaredCombatRuleOption } from './declared-rule-hooks'
