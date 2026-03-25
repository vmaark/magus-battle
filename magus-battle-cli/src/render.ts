import chalk from 'chalk'
import type {
  RoundResult,
  CombatEvent,
  CombatantSnapshot,
  EncounterResult,
  InitiativeEntry,
} from 'magus-battle-simulator'

const BAR_WIDTH = 18

const hpBar = (current: number, max: number): string => {
  const clamped = Math.max(0, current)
  const ratio = max > 0 ? clamped / max : 0
  const filled = Math.round(ratio * BAR_WIDTH)
  const empty = BAR_WIDTH - filled
  const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty))
  if (ratio > 0.6) return chalk.green(bar)
  if (ratio > 0.3) return chalk.yellow(bar)
  return chalk.red(bar)
}

const statusLabel = (status: CombatantSnapshot['status']): string => {
  switch (status) {
    case 'active':      return chalk.green('aktív')
    case 'unconscious': return chalk.yellow('ájult')
    case 'dead':        return chalk.red('halott')
  }
}

const partyLabel = (party: 'a' | 'b'): string =>
  party === 'a' ? chalk.cyan('[A]') : chalk.magenta('[B]')

const weaponLine = (snap: CombatantSnapshot): string => {
  const w = snap.weapon
  const stats = [
    w.ke !== 0 ? `KÉ${w.ke > 0 ? '+' : ''}${w.ke}` : null,
    w.te !== 0 ? `TÉ${w.te > 0 ? '+' : ''}${w.te}` : null,
    w.ve !== 0 ? `VÉ${w.ve > 0 ? '+' : ''}${w.ve}` : null,
  ]
    .filter(Boolean)
    .join(' ')
  const statStr = stats ? ` ${chalk.dim(stats)}` : ''
  return `${w.name} ${chalk.dim(w.damage)}${statStr} | ${snap.armor.name} SFÉ:${snap.armor.sfe}`
}

const combatantRow = (snap: CombatantSnapshot): string => {
  const party = partyLabel(snap.party)
  const name = snap.name.padEnd(18)
  const fpBar = hpBar(snap.fp, snap.maxFp)
  const epBar = hpBar(snap.ep, snap.maxEp)
  const fp = `Fp: ${String(snap.fp).padStart(3)}/${snap.maxFp}`
  const ep = `Ép: ${String(Math.max(0, snap.ep)).padStart(2)}/${snap.maxEp}`
  return [
    `  ${party} ${chalk.bold(name)}`,
    `     ${weaponLine(snap)}`,
    `     ${fpBar} ${fp}   ${epBar} ${ep}   ${statusLabel(snap.status)}`,
  ].join('\n')
}

const renderInitiatives = (entries: InitiativeEntry[]): string => {
  const lines = ['', chalk.bold('⚔  Kezdeményezés:')]
  entries.forEach((e, i) => {
    const rank = String(i + 1).padStart(2)
    const name = e.name.padEnd(16)
    if (e.lostInitiative) {
      lines.push(`  ${rank}. ${chalk.bold(name)} ${chalk.yellow('⚠ elveszítve')} (előző körben Ép-sérülés)`)
    } else {
      lines.push(`  ${rank}. ${chalk.bold(name)} k10: ${e.die} + KÉ → ${chalk.bold(e.total)}`)
    }
  })
  return lines.join('\n')
}

const renderEvent = (e: CombatEvent): string => {
  if (e.eventType === 'action') {
    const lines = [
      `\n  ${chalk.bold(e.actorName)}${e.targetName ? ` → ${chalk.bold(e.targetName)}` : ''}`,
      `    ${chalk.yellow(e.actionType === 'close_distance' ? '↣ ZÁRKÓZÁS' : '… NINCS VÉGREHAJTHATÓ TÁMADÁS')}`,
    ]
    if (e.reason) lines.push(`    ${chalk.dim(e.reason)}`)
    if (e.distanceBeforeFeet !== undefined && e.distanceAfterFeet !== undefined) {
      lines.push(`    Távolság: ${e.distanceBeforeFeet} → ${e.distanceAfterFeet} láb`)
    }
    if (e.appliedRules.length > 0) {
      lines.push(`    ${chalk.dim('Szabályok:')}`)
      for (const rule of e.appliedRules) {
        lines.push(`      ${chalk.dim(`- ${rule.ref.code} (${rule.ref.source} ${rule.ref.section}): ${rule.explanation}`)}`)
      }
    }
    return lines.join('\n')
  }
  const w = e.attackerWeapon
  const weaponStr = `${w.name} (${w.damage})`
  const lines = [
    `\n  ${chalk.bold(e.attackerName)} ${chalk.dim(`[${weaponStr}]`)} → ${chalk.bold(e.defenderName)}`,
  ]

  if (e.criticalMiss) {
    lines.push(`    ${chalk.red('✗ KRITIKUS KUDARC')} (dobás: 01) — automatikus tévesztés`)
    return lines.join('\n')
  }

  const rollStr = e.automaticHit
    ? `Támadó dobás: ${chalk.bold('nincs')} (automatikus találat szabály alapján)`
    : e.attackMode === 'ranged'
      ? `k100: ${chalk.bold(String(e.roll))} + CÉ ${e.attackerCeTotal} = ${chalk.bold(String(e.attackTotal))}`
      : `k100: ${chalk.bold(String(e.roll))} + TÉ ${e.attackerTeTotal} = ${chalk.bold(String(e.attackTotal))}`
  const veStr = `VÉ ${e.defenderVe}`

  let hitLabel: string
  if (!e.hit) {
    hitLabel = chalk.gray(`✗ TÉVESZTÉS (${e.attackTotal} < ${e.defenderVe})`)
  } else if (e.automaticFatal) {
    hitLabel = chalk.red('☠ AZONNALI HALÁLOS TALÁLAT')
  } else if (e.criticalHit) {
    hitLabel = chalk.yellow('✦ KRITIKUS TALÁLAT (00)')
  } else if (e.overthit) {
    hitLabel = chalk.red(`✦ TALÁLAT + TÚLÜTÉS (+${e.attackTotal - e.defenderVe} ≥ 50)`)
  } else {
    hitLabel = chalk.green('✓ TALÁLAT')
  }

  if (e.automaticHit) {
    lines.push(`    ${rollStr} → ${hitLabel}`)
  } else {
    lines.push(`    ${rollStr} ≥ ${veStr} → ${hitLabel}`)
  }

  if (e.hit && (e.damage > 0 || e.criticalHit)) {
    const sfe = e.rawDamage - e.damage
    let dmgStr = `${w.damage} → ${e.rawDamage}`
    if (e.criticalHit) dmgStr += chalk.dim(' (00: SFÉ figyelmen kívül)')
    else if (sfe > 0) dmgStr += ` − ${sfe} SFÉ = ${chalk.bold(String(e.damage))}`
    if (e.overthit) dmgStr += chalk.red(' → közvetlenül Ép!')
    if (e.criticalHit && e.epLoss > 0) dmgStr += chalk.yellow(' +3 Ép (00-as)')
    lines.push(`    Sebzés: ${dmgStr}`)

    const fpBefore = e.defenderFpAfter + e.fpLoss
    const epBefore = e.defenderEpAfter + e.epLoss
    const epAfterDisplay = Math.max(0, e.defenderEpAfter)

    const lossParts: string[] = []
    if (e.fpLoss > 0) lossParts.push(`Fp −${e.fpLoss} (${fpBefore}→${e.defenderFpAfter})`)
    if (e.epLoss > 0) lossParts.push(`Ép −${e.epLoss} (${epBefore}→${epAfterDisplay})`)

    if (lossParts.length > 0) lines.push(`    Veszteség: ${lossParts.join('   ')}`)

    if (e.defenderStatusAfter === 'unconscious') {
      lines.push(`    ${chalk.yellow(`⚠  ${e.defenderName} ELÁJULT`)}`)
    } else if (e.defenderStatusAfter === 'dead') {
      lines.push(`    ${chalk.red(`✝  ${e.defenderName} MEGHALT`)}`)
    }
  }

  if (e.appliedRules.length > 0) {
    lines.push(`    ${chalk.dim('Szabályok:')}`)
    for (const rule of e.appliedRules) {
      lines.push(`      ${chalk.dim(`- ${rule.ref.code} (${rule.ref.source} ${rule.ref.section}): ${rule.explanation}`)}`)
    }
  }

  return lines.join('\n')
}

const renderOutnumbered = (penalties: Record<string, number>, stateAfter: CombatantSnapshot[]): string => {
  const entries = Object.entries(penalties).filter(([, v]) => v > 0)
  if (entries.length === 0) return ''
  const snapsById = new Map(stateAfter.map(s => [s.id, s]))
  const parts = entries.map(([id, pen]) => {
    const name = snapsById.get(id)?.name ?? id
    return `${name} −${pen} VÉ`
  })
  return `\n  ${chalk.dim(`Túlerő VÉ-levonás: ${parts.join(', ')}`)}`
}

const renderStateTable = (stateAfter: CombatantSnapshot[]): string => {
  const lines = ['', chalk.bold('📊 Kör végi állapot:')]
  for (const snap of stateAfter) {
    lines.push(combatantRow(snap))
  }
  return lines.join('\n')
}

export const renderRound = (result: RoundResult): string => {
  const divider = chalk.dim('─'.repeat(58))
  const header = chalk.bold(`\n${'═'.repeat(20)} ${result.round}. KÖR ${'═'.repeat(20)}`)

  const parts: string[] = [header, divider]

  parts.push(renderInitiatives(result.initiatives))

  const hasOutnumbered = Object.values(result.outnumberedPenalties).some(v => v > 0)
  if (hasOutnumbered) {
    parts.push(renderOutnumbered(result.outnumberedPenalties, result.stateAfter))
  }

  if (result.events.length > 0) {
    parts.push('')
    const segmentGroups = new Map<number, CombatEvent[]>()
    for (const e of result.events) {
      const group = segmentGroups.get(e.segment) ?? []
      group.push(e)
      segmentGroups.set(e.segment, group)
    }
    for (const [seg, events] of Array.from(segmentGroups.entries()).sort((a, b) => a[0] - b[0])) {
      parts.push(chalk.dim(`📍 Szegmens ${seg}:`))
      for (const e of events) parts.push(renderEvent(e))
    }
  } else {
    parts.push(chalk.dim('\n  (Ebben a körben nem történt csapás)'))
  }

  parts.push(renderStateTable(result.stateAfter))

  return parts.join('\n')
}

export const renderHeader = (aName: string, bName: string, aCount: number, bCount: number): string => {
  const title = chalk.bold.white('M.A.G.U.S. CSATASZIMULÁTOR')
  const line = '═'.repeat(58)
  return [
    '',
    chalk.bold(line),
    `  ${title}`,
    chalk.bold(line),
    `  ${chalk.cyan(`[A] ${aName}`)} (${aCount} fő)  vs.  ${chalk.magenta(`[B] ${bName}`)} (${bCount} fő)`,
    '',
  ].join('\n')
}

export const renderParty = (label: string, snapshots: CombatantSnapshot[]): string => {
  const lines = [`\n${chalk.bold(`${label}:`)}`]
  for (const snap of snapshots) lines.push(combatantRow(snap))
  return lines.join('\n')
}

export const renderResult = (result: EncounterResult): string => {
  const line = '═'.repeat(58)
  let verdict: string
  switch (result.winner) {
    case 'a':
      verdict = chalk.cyan.bold('🏆 GYŐZTES: A csapat')
      break
    case 'b':
      verdict = chalk.magenta.bold('🏆 GYŐZTES: B csapat')
      break
    case 'draw':
      verdict = chalk.yellow.bold('⚖  DÖNTETLEN')
      break
    default:
      verdict = chalk.dim('(limit elérve, nincs győztes)')
  }
  return [
    '',
    chalk.bold(line),
    `  ${verdict}  —  ${result.rounds.length} kör után`,
    chalk.bold(line),
    '',
  ].join('\n')
}
