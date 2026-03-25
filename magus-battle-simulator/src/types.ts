/**
 * M.A.G.U.S. harci szimulátor — alaptípusok
 * Szabályok: rules/harcrendszer.md, rules/eletero.md
 */

/** Méretkategória — meghatározza a fegyver időigényét */
export type WeaponCategory = 1 | 2 | 3 | 4 | 5

/**
 * Szegmensköltség méretkategóriánként (harcrendszer.md §2)
 * 1: pusztakéz/ököl, 2: tőr, 3: egykezes, 4: nehézfegyver, 5: nyeles
 */
export const SEGMENT_COST: Record<WeaponCategory, number> = {
  1: 3,
  2: 3,
  3: 5,
  4: 10,
  5: 10,
}

export const ROUND_SEGMENTS = 10

export type Weapon = {
  name: string
  category: WeaponCategory
  /** KÉ bónusz a fegyvertől */
  ke: number
  /** TÉ bónusz a fegyvertől */
  te: number
  /** VÉ bónusz a fegyvertől */
  ve: number
  /** CÉ bónusz a fegyvertől */
  ce: number
  /** Sebzéskifejezés, pl. "2k6+3", "1k10" */
  damage: string
}

export type Armor = {
  name: string
  /** Mozgásgátló tényező — harcértékekre (KÉ/TÉ/VÉ/CÉ) alkalmazott módosító */
  mgt: number
  /** Sebzésfelfogó érték — ennyi vonódik le a becsapódó sebzésből */
  sfe: number
}

export type CombatantStatus = 'active' | 'unconscious' | 'dead'

export type Combatant = {
  id: string
  name: string
  /** Kezdeményező érték */
  ke: number
  /** Támadó érték */
  te: number
  /** Védő érték */
  ve: number
  /** Célzó érték */
  ce: number
  maxEp: number
  /** Aktuális Életerő pont */
  ep: number
  maxFp: number
  /** Aktuális Fájdalomtűrés pont */
  fp: number
  weapon: Weapon
  armor: Armor
  /** Ha igaz, a morális szabály érvényes: egy csapással nem csökkenhet 0 Ép alá */
  isPlayerCharacter: boolean
  status: CombatantStatus
  /** KM által meghatározott célpont azonosítója; ha nincs, a stratégia választja */
  targetId?: string
}

/** Részleges módosítás, amelyet a KM bármikor alkalmazhat */
export type CombatantPatch = Partial<Omit<Combatant, 'id'>>

export type DiceRoller = (sides: number) => number

export type RuleReference = {
  code: string
  source: 'harcrendszer' | 'eletero'
  section: string
}

export type AppliedRule = {
  ref: RuleReference
  explanation: string
}

/** Pillanatfelvétel egy harcos állapotáról (csak olvasható) */
export type CombatantSnapshot = {
  id: string
  name: string
  party: 'a' | 'b'
  ke: number
  te: number
  ve: number
  ce: number
  fp: number
  maxFp: number
  ep: number
  maxEp: number
  status: CombatantStatus
  weapon: Weapon
  armor: Armor
  targetId?: string
}

export type TargetingStrategy =
  | 'random'
  | 'weakest'   // legalacsonyabb (fp+ep)/(maxFp+maxEp) arány
  | 'strongest' // legmagasabb TÉ
  | ((attacker: CombatantSnapshot, enemies: CombatantSnapshot[]) => string)

export type OptionalRules = {
  /**
   * Minden 5 Fp veszteség (egyetlen sebzéstől) → 1 kötelező Ép veszteség (eletero.md §5).
   * Alapértelmezés: true
   */
  mandatoryEpFromFp: boolean
  /**
   * Sérülési harcérték-módosítók (eletero.md §5):
   * - Max Fp >90% elveszett: -10 minden harcérték
   * - Max Ép >=50% elveszett: -10 minden harcérték
   * - Max Ép >=75% elveszett: KÉ -10, TÉ -20, VÉ -10, CÉ -30
   * A módosítók nem adódnak össze.
   * Alapértelmezés: true
   */
  injuryStatPenalties: boolean
}

export type AttackModifierContext = {
  round: number
  segment: number
  attacker: CombatantSnapshot
  defender: CombatantSnapshot
}

export type AttackModifierResult = {
  attackerTeModifier?: number
  defenderVeModifier?: number
  appliedRules?: AppliedRule[]
}

export type CombatRuleHooks = {
  resolveAttackModifiers?: (context: AttackModifierContext) => AttackModifierResult | undefined
}

export type EncounterOptions = {
  roller?: DiceRoller
  targeting?: TargetingStrategy
  optionalRules?: Partial<OptionalRules>
  ruleHooks?: CombatRuleHooks
}

export type InitiativeEntry = {
  combatantId: string
  name: string
  /** Nyers k10 dobás */
  die: number
  /** die + KÉ (elveszített kezdeményezésnél −1) */
  total: number
  /** Előző körben Ép veszteséget szenvedett → utolsóként cselekszik */
  lostInitiative: boolean
}

export type AttackEvent = {
  round: number
  segment: number
  attackerId: string
  attackerName: string
  /** A támadó fegyvere (névvel és statokkal együtt) */
  attackerWeapon: Weapon
  defenderId: string
  defenderName: string
  /** Nyers k100 dobás */
  roll: number
  /** roll + támadó TÉ összesen */
  attackTotal: number
  /** Tényleges VÉ (túlerő-levonás után) */
  defenderVe: number
  /** Alaphelyzet TÉ + külső módosítók */
  attackerTeTotal: number
  hit: boolean
  /** Nincs dobás, automatikus találat (pl. 0 Ép állapotban lévő célpont) */
  automaticHit: boolean
  /** A támadás azonnal halálos (morális szabály utóhatása) */
  automaticFatal: boolean
  /** roll === 100: automatikus találat, SFÉ nem érvényesül, +3 Ép bónusz */
  criticalHit: boolean
  /** roll === 1: automatikus kudarc */
  criticalMiss: boolean
  /** attackTotal ≥ defenderVe + 50: sebzés közvetlenül Ép-t csökkent */
  overthit: boolean
  /** Dobott sebzés SFÉ előtt */
  rawDamage: number
  /** Tényleges sebzés SFÉ levonása után */
  damage: number
  fpLoss: number
  epLoss: number
  defenderFpAfter: number
  /** Negatív lehet NJK esetén (overkill) */
  defenderEpAfter: number
  defenderStatusAfter: CombatantStatus
  /** Alkalmazott szabályok (strukturált + emberi magyarázat) */
  appliedRules: AppliedRule[]
}

export type RoundResult = {
  round: number
  initiatives: InitiativeEntry[]
  /** Túlerő miatti VÉ-levonások, harcos azonosítónként */
  outnumberedPenalties: Record<string, number>
  events: AttackEvent[]
  /** Minden harcos állapota a kör végén */
  stateAfter: CombatantSnapshot[]
}

export type EncounterState = {
  round: number
  partyA: CombatantSnapshot[]
  partyB: CombatantSnapshot[]
  isOver: boolean
  winner: 'a' | 'b' | 'draw' | null
}

export type EncounterResult = {
  rounds: RoundResult[]
  winner: 'a' | 'b' | 'draw' | null
}

export type Encounter = {
  /** Következő kör végrehajtása. Hibát dob, ha az ütközet már véget ért. */
  nextRound: () => RoundResult
  /** Futtatás befejezésig (vagy maxRounds körig). */
  run: (maxRounds?: number) => EncounterResult
  /** KM: bármely stat módosítása menet közben */
  modifyCombatant: (id: string, patch: CombatantPatch) => void
  /** KM: harcos eltávolítása a csatából (menekülés, elfogás stb.) */
  removeCombatant: (id: string) => void
  /** KM: erősítés hozzáadása valamelyik csapathoz */
  addCombatant: (party: 'a' | 'b', combatant: Combatant) => void
  /** Az ütközet aktuális állapotának pillanatfelvétele */
  getState: () => EncounterState
  isOver: () => boolean
}
