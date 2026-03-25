/**
 * Forgatókönyv JSON → könyvtár típusok leképezése
 */

import type { Combatant, TargetingStrategy, EncounterOptions } from 'magus-battle-simulator'

export type Scenario = {
  partyA: Combatant[]
  partyB: Combatant[]
  settings?: {
    /** "random" | "weakest" | "strongest" (HU aliasok is elfogadva) */
    targeting?: string
    /** Maximum körök száma — alapértelmezés: 100 */
    maxRounds?: number
    /** Kötelező Ép veszteség szabály (minden 5 Fp → 1 Ép) — alapértelmezés: true */
    mandatoryEpFromFp?: boolean
    /** Sérülési harcérték-módosítók (eletero.md §5) — alapértelmezés: true */
    injuryStatPenalties?: boolean
  }
}

const TARGETING_MAP: Record<string, TargetingStrategy> = {
  random: 'random',
  weakest: 'weakest',
  strongest: 'strongest',
  leggyengebb: 'weakest',
  legerosebb: 'strongest',
}

export type ParsedScenario = {
  partyA: Combatant[]
  partyB: Combatant[]
  options: EncounterOptions
  maxRounds: number
}

export const parseScenario = (raw: unknown): ParsedScenario => {
  const s = raw as Scenario

  if (!s.partyA || !Array.isArray(s.partyA) || s.partyA.length === 0)
    throw new Error('A "partyA" mező kötelező és legalább 1 harcost kell tartalmazzon.')
  if (!s.partyB || !Array.isArray(s.partyB) || s.partyB.length === 0)
    throw new Error('A "partyB" mező kötelező és legalább 1 harcost kell tartalmazzon.')

  const targeting: TargetingStrategy =
    TARGETING_MAP[s.settings?.targeting ?? 'random'] ?? 'random'

  return {
    partyA: s.partyA,
    partyB: s.partyB,
    options: {
      targeting,
      optionalRules: {
        mandatoryEpFromFp: s.settings?.mandatoryEpFromFp ?? true,
        injuryStatPenalties: s.settings?.injuryStatPenalties ?? true,
      },
    },
    maxRounds: s.settings?.maxRounds ?? 100,
  }
}
