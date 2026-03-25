import type { DiceRoller } from './types'

export const defaultRoller: DiceRoller = (sides) =>
  Math.floor(Math.random() * sides) + 1

/** k100 dobás: 1–100. A 100 jelenti a „00"-t (kritikus találat), az 1 a „01"-et (kritikus kudarc). */
export const rollK100 = (roller: DiceRoller): number => roller(100)

/**
 * Sebzéskifejezés kiértékelése: [N]k<lapok>[+|-<bónusz>]
 * Pl.: "2k6+3", "1k10", "k6"
 * Minimum eredmény: 1.
 */
export const rollDamage = (expression: string, roller: DiceRoller): number => {
  const match = expression.match(/^(\d*)k(\d+)([+-]\d+)?$/i)
  if (!match) throw new Error(`Érvénytelen sebzéskifejezés: "${expression}"`)

  const count = parseInt(match[1] || '1', 10)
  const sides = parseInt(match[2], 10)
  const bonus = match[3] ? parseInt(match[3], 10) : 0

  let total = 0
  for (let i = 0; i < count; i++) total += roller(sides)
  return Math.max(1, total + bonus)
}

/**
 * Íjász szabály (harcrendszer.md §7):
 * ha egy sebzéskocka maximumot dob, ugyanazzal a kockával újra dobunk,
 * és addig ismételjük, amíg maximumot ad.
 */
export const rollDamageWithArcherRule = (
  expression: string,
  roller: DiceRoller,
): { total: number; triggered: boolean } => {
  const match = expression.match(/^(\d*)k(\d+)([+-]\d+)?$/i)
  if (!match) throw new Error(`Érvénytelen sebzéskifejezés: "${expression}"`)

  const count = parseInt(match[1] || '1', 10)
  const sides = parseInt(match[2], 10)
  const bonus = match[3] ? parseInt(match[3], 10) : 0

  let total = 0
  let triggered = false
  for (let i = 0; i < count; i++) {
    let roll = roller(sides)
    total += roll
    while (roll === sides) {
      triggered = true
      roll = roller(sides)
      total += roll
    }
  }

  return { total: Math.max(1, total + bonus), triggered }
}
