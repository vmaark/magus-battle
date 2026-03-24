export type YesNoFlag = 'igen' | 'nem' | 'igen*' | null

export type SegmentRequirement = number | 'roham' | `${number} kör`

export type WeaponSkillCategory =
  | 'kozelharci'
  | 'hajitofegyver'
  | 'ij'
  | 'nyilpuska'
  | 'celzofegyver'

export type WeaponRecord = {
  name: string
  /**
   * Fegyver főcsoportja:
   * - "kozelharci": méretkategória alapú közelharci fegyverek
   * - "hajitofegyver", "ij", "nyilpuska", "celzofegyver": távfegyver alcsaládok
   */
  kind: WeaponSkillCategory
  /** Közelharci méretkategória (1..5), ha értelmezett */
  category?: 1 | 2 | 3 | 4 | 5
  /** Pl. "tőr jellegű", "egykezes kardok", "Nehézkardok" */
  subgroup?: string
  time: SegmentRequirement
  damage: string
  ke: number | null
  te: number | null
  ve: number | null
  ce: number | null
  /** Lábban, ha értelmezett */
  rangeFeet: number | null
  /** Ynevi font */
  weight: number | null
  /**
   * Ár rövid alakban, pl. "1a5e", "40r".
   * Ha nincs ismert ár: null.
   */
  price: string | null
  disarm: YesNoFlag
  weaponBreak: YesNoFlag
  penetration: YesNoFlag
  stp: number | null
  notes?: string[]
}

export type ShieldRecord = {
  name: string
  mgt: number | null
  ve: number | null
  coverVe: number | null
  weight: number | null
  notes?: string[]
}

export type ArmorRecord = {
  name: string
  mgt: number
  sfe: number
  weight: number
  price: string | null
  stp: number
  notes?: string[]
}

export type RuleNote = {
  rule: string
  description: string
}

export type EquipmentDataset = {
  source: {
    file: string
    pages: {
      from: string
      to: string
    }
    language: 'hu'
    ocrNormalized: boolean
  }
  weapons: WeaponRecord[]
  weaponSpecialProperties: RuleNote[]
  shields: ShieldRecord[]
  shieldSpecialProperties: RuleNote[]
  armors: ArmorRecord[]
  armorSpecialProperties: RuleNote[]
  relatedRules: RuleNote[]
}
