import { useMemo, useRef, useState } from 'react'
import {
  createEncounter,
  createDeclaredCombatRuleHooks,
  DECLARED_COMBAT_RULE_OPTIONS,
  MAGUS_EQUIPMENT_DATA,
} from 'magus-battle-simulator'
import type {
  AppliedRule,
  AttackEvent,
  CombatEvent,
  ArmorRecord,
  Combatant,
  CombatantSnapshot,
  DeclaredCombatRule,
  DeclaredCombatRuleId,
  DistanceKey,
  DistanceMap,
  EncounterResult,
  InitiativeEntry,
  Party,
  RoundResult,
  WeaponRecord,
} from 'magus-battle-simulator'
import { DEFAULT_SCENARIO, parseScenario } from './scenario'
import type { Scenario } from './scenario'

type RunState = {
  initialA: CombatantSnapshot[]
  initialB: CombatantSnapshot[]
  initialDistances: DistanceMap
  roundDistances: Record<number, DistanceMap>
  result: EncounterResult
}

const distanceKey = (attackerId: string, defenderId: string): DistanceKey =>
  `${attackerId}->${defenderId}`

const getPairDistance = (
  distances: DistanceMap | undefined,
  attackerId: string,
  defenderId: string,
): number | null => {
  if (!distances) return null
  const direct = distances[distanceKey(attackerId, defenderId)]
  if (Number.isFinite(direct)) return Math.max(0, Number(direct))
  const reverse = distances[distanceKey(defenderId, attackerId)]
  if (Number.isFinite(reverse)) return Math.max(0, Number(reverse))
  return null
}

const setPairDistance = (
  distances: DistanceMap,
  attackerId: string,
  defenderId: string,
  value: number,
) => {
  const normalized = Math.max(0, Math.floor(value))
  distances[distanceKey(attackerId, defenderId)] = normalized
  distances[distanceKey(defenderId, attackerId)] = normalized
}

const buildRoundDistances = (
  initialDistances: DistanceMap,
  rounds: RoundResult[],
): Record<number, DistanceMap> => {
  const current = { ...initialDistances }
  const byRound: Record<number, DistanceMap> = {}
  for (const round of rounds) {
    for (const event of round.events) {
      if (
        event.eventType === 'action' &&
        event.actionType === 'close_distance' &&
        event.targetId &&
        event.distanceAfterFeet !== undefined
      ) {
        setPairDistance(current, event.actorId, event.targetId, event.distanceAfterFeet)
      }
    }
    byRound[round.round] = { ...current }
  }
  return byRound
}

const isRangedCombatant = (c: CombatantSnapshot): boolean =>
  c.weapon.attackMode === 'ranged' || c.weapon.ce > 0

const roundDistancePairs = (
  combatants: CombatantSnapshot[],
  distances: DistanceMap | undefined,
): Array<{ left: CombatantSnapshot; right: CombatantSnapshot; distanceFeet: number }> => {
  if (!distances) return []
  const byId = new Map(combatants.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const pairs: Array<{ left: CombatantSnapshot; right: CombatantSnapshot; distanceFeet: number }> = []

  for (const [key, rawDistance] of Object.entries(distances) as Array<[DistanceKey, number]>) {
    const [leftId, rightId] = key.split('->')
    if (!leftId || !rightId) continue
    const left = byId.get(leftId)
    const right = byId.get(rightId)
    if (!left || !right) continue
    if (left.party === right.party) continue

    const pairKey = [leftId, rightId].sort().join('|')
    if (seen.has(pairKey)) continue
    seen.add(pairKey)

    const distanceFeet = Math.max(0, Math.floor(rawDistance))
    const distanceRelevant =
      distanceFeet > 0 || isRangedCombatant(left) || isRangedCombatant(right)
    if (!distanceRelevant) continue

    pairs.push({ left, right, distanceFeet })
  }

  return pairs.sort((a, b) => a.distanceFeet - b.distanceFeet)
}

const roundTargetAssignments = (
  combatants: CombatantSnapshot[],
): Array<{ attacker: CombatantSnapshot; target: CombatantSnapshot | null }> => {
  const byId = new Map(combatants.map((c) => [c.id, c]))
  return combatants
    .filter((c) => c.targetId)
    .map((attacker) => ({
      attacker,
      target: attacker.targetId ? byId.get(attacker.targetId) ?? null : null,
    }))
}

const getRoundEffectiveTargetMap = (events: CombatEvent[]): Record<string, string> => {
  const targetByActor: Record<string, string> = {}
  for (const event of events) {
    if (event.eventType === 'attack') {
      targetByActor[event.attackerId] = event.defenderId
      continue
    }
    if (event.eventType === 'action' && event.targetId) {
      targetByActor[event.actorId] = event.targetId
    }
  }
  return targetByActor
}

const normalizeLookup = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const weaponPresetByName = new Map<string, WeaponRecord>()
for (const weapon of MAGUS_EQUIPMENT_DATA.weapons) {
  const key = normalizeLookup(weapon.name)
  if (!weaponPresetByName.has(key)) weaponPresetByName.set(key, weapon)
}
const weaponPresetNames = Array.from(weaponPresetByName.values())
  .map((weapon) => weapon.name)
  .sort((a, b) => a.localeCompare(b, 'hu'))

const armorPresetByName = new Map<string, ArmorRecord>()
for (const armor of MAGUS_EQUIPMENT_DATA.armors) {
  armorPresetByName.set(normalizeLookup(armor.name), armor)
}
const armorPresetNames = MAGUS_EQUIPMENT_DATA.armors
  .map((armor) => armor.name)
  .sort((a, b) => a.localeCompare(b, 'hu'))

const deriveAttackMode = (rangeFeet: number | undefined): 'melee' | 'ranged' =>
  (rangeFeet ?? 0) > 0 ? 'ranged' : 'melee'

const formatRules = (rules: AppliedRule[]): string =>
  rules.map((r) => `${r.ref.code} (${r.ref.source} ${r.ref.section}): ${r.explanation}`).join('\n')

const ratioClass = (current: number, max: number): string => {
  const ratio = max > 0 ? Math.max(0, current) / max : 0
  if (ratio > 0.6) return 'ok'
  if (ratio > 0.3) return 'warn'
  return 'danger'
}

const statusLabel = (status: CombatantSnapshot['status']): string => {
  switch (status) {
    case 'active':
      return 'aktív'
    case 'unconscious':
      return 'ájult'
    case 'dead':
      return 'halott'
  }
}

const partyName = (party: Party): string => (party === 'a' ? 'A' : 'B')

const HealthBar = ({ current, max, label }: { current: number; max: number; label: string }) => {
  const clamped = Math.max(0, current)
  const percent = max > 0 ? Math.max(0, Math.min(100, (clamped / max) * 100)) : 0
  const cls = ratioClass(clamped, max)
  return (
    <div className="hp-wrap">
      <div className="hp-label">
        <span>{label}</span>
        <span>
          {clamped}/{max}
        </span>
      </div>
      <div className="hp-track">
        <div className={`hp-fill ${cls}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

const InitiativeList = ({ entries }: { entries: InitiativeEntry[] }) => {
  if (entries.length === 0) return null
  return (
    <div className="initiative-list">
      <h4>Kezdeményezés</h4>
      <ul>
        {entries.map((e, idx) => (
          <li key={e.combatantId} className={e.lostInitiative ? 'lost-init' : ''}>
            <span className="rank">{idx + 1}.</span>
            <span className="name">{e.name}</span>
            {e.lostInitiative ? (
              <span className="meta">elveszítve (előző körben Ép-sérülés)</span>
            ) : (
              <span className="meta">
                k10: {e.die} + KÉ = <strong>{e.total}</strong>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const EventCard = ({ e }: { e: CombatEvent }) => {
  if (e.eventType === 'action') {
    const actionLabel =
      e.actionType === 'close_distance' ? 'Távolság zárkózás' : 'Nincs végrehajtható támadás'
    return (
      <div className="event-card">
        <div className="event-title">
          {e.actorName}
          {e.targetName ? ` → ${e.targetName}` : ''}
        </div>
        <div className="event-meta">
          <span>Szegmens: {e.segment}</span>
          <span className="event-tag miss">{actionLabel}</span>
        </div>
        {e.reason && <div className="event-line">{e.reason}</div>}
        {e.distanceBeforeFeet !== undefined && e.distanceAfterFeet !== undefined && (
          <div className="event-line">
            Távolság: {e.distanceBeforeFeet} → {e.distanceAfterFeet} láb
          </div>
        )}
        {e.appliedRules.length > 0 && (
          <details open>
            <summary>Alkalmazott szabályok</summary>
            <pre>{formatRules(e.appliedRules)}</pre>
          </details>
        )}
      </div>
    )
  }
  const headline = e.automaticFatal
    ? 'Azonnali halálos találat'
    : e.criticalHit
      ? 'Kritikus találat (00)'
      : e.criticalMiss
        ? 'Kritikus kudarc (01)'
        : e.hit
          ? 'Találat'
          : 'Tévesztés'
  const headlineClass = e.automaticFatal
    ? 'fatal'
    : e.criticalHit
      ? 'critical'
      : e.criticalMiss || !e.hit
        ? 'miss'
        : e.overthit
          ? 'overhit'
          : 'hit'

  return (
    <div className="event-card">
      <div className="event-title">
        {e.attackerName} [{e.attackerWeapon.name}] → {e.defenderName}
      </div>
      <div className="event-meta">
        <span>Szegmens: {e.segment}</span>
        <span className={`event-tag ${headlineClass}`}>{headline}</span>
      </div>
      <div className="event-line">
        {e.automaticHit
          ? 'Dobás nélkül, automatikus találat.'
          : e.attackMode === 'ranged'
            ? `k100 ${e.roll} + CÉ ${e.attackerCeTotal} = ${e.attackTotal} vs VÉ ${e.defenderVe} (táv alap: ${e.rangedDefenseBase ?? '-'})`
            : `k100 ${e.roll} + TÉ ${e.attackerTeTotal} = ${e.attackTotal} vs VÉ ${e.defenderVe}`}
      </div>
      {e.distanceFeet !== undefined && e.attackMode === 'ranged' && (
        <div className="event-line event-distance">Távolság: {e.distanceFeet} láb</div>
      )}
      {e.hit && (
        <div className="event-line">
          Sebzés: nyers {e.rawDamage}, nettó {e.damage}, Fp−{e.fpLoss}, Ép−{e.epLoss}
        </div>
      )}
      {e.appliedRules.length > 0 && (
        <details open>
          <summary>Alkalmazott szabályok</summary>
          <pre>{formatRules(e.appliedRules)}</pre>
        </details>
      )}
    </div>
  )
}

const PartyTable = ({
  title,
  party,
  allCombatants,
  distances,
  effectiveTargets,
}: {
  title: string
  party: CombatantSnapshot[]
  allCombatants: CombatantSnapshot[]
  distances?: DistanceMap
  effectiveTargets?: Record<string, string>
}) => (
  <div className="panel">
    <h3>{title}</h3>
    <div className="table-scroll">
      <table className="party-table">
        <thead>
          <tr>
            <th>Csapat</th>
            <th>Név</th>
            <th>Állapot</th>
            <th>Fp</th>
            <th>Ép</th>
            <th>Fegyver / páncél</th>
            <th>KÉ</th>
            <th>TÉ</th>
            <th>VÉ</th>
            <th>CÉ</th>
            <th>Célpont</th>
          </tr>
        </thead>
        <tbody>
          {party.map((c) => {
            const shownTargetId = effectiveTargets?.[c.id] ?? c.targetId
            const target = shownTargetId
              ? allCombatants.find((candidate) => candidate.id === shownTargetId)
              : undefined
            const distanceFeet = shownTargetId ? getPairDistance(distances, c.id, shownTargetId) : null
            const distanceRelevant =
              distanceFeet !== null &&
              (distanceFeet > 0 || isRangedCombatant(c) || (target ? isRangedCombatant(target) : false))
            const distanceClass =
              distanceFeet === null
                ? ''
                : distanceFeet <= 5
                  ? 'near'
                  : distanceFeet <= 30
                    ? 'mid'
                    : 'far'
            return (
            <tr key={c.id}>
              <td>
                <span className={`party-badge ${c.party}`}>[{partyName(c.party)}]</span>
              </td>
              <td>{c.name}</td>
              <td>
                <span className={`status-badge ${c.status}`}>{statusLabel(c.status)}</span>
              </td>
              <td>
                <HealthBar current={c.fp} max={c.maxFp} label="Fp" />
              </td>
              <td>
                <HealthBar current={c.ep} max={c.maxEp} label="Ép" />
              </td>
              <td>
                {c.weapon.name} ({c.weapon.damage})<br />
                <span className="muted">
                  {c.armor.name} SFÉ:{c.armor.sfe} MGT:{c.armor.mgt}
                </span>
              </td>
              <td>{c.ke}</td>
              <td>{c.te}</td>
              <td>{c.ve}</td>
              <td>{c.ce}</td>
              <td>
                {shownTargetId ? (
                  <div className="target-cell">
                    <div className="target-name">{target?.name ?? shownTargetId}</div>
                    {distanceRelevant && (
                      <span className={`distance-badge ${distanceClass}`}>{distanceFeet} láb</span>
                    )}
                  </div>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  </div>
)

const splitByParty = (stateAfter: CombatantSnapshot[]): { a: CombatantSnapshot[]; b: CombatantSnapshot[] } => ({
  a: stateAfter.filter((s) => s.party === 'a'),
  b: stateAfter.filter((s) => s.party === 'b'),
})
type TeamSide = Party

const createEmptyDeclaredRule = (): DeclaredCombatRule => ({
  id: `decl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sourceId: '',
  ruleId: 'meglepetesszeru_tamadas',
})

const getOpposingParty = (party: Party): Party => (party === 'a' ? 'b' : 'a')

const createEmptyCombatant = (partyPrefix: Party, idx: number): Combatant => ({
  id: `${partyPrefix}-${Date.now()}-${idx}`,
  name: `Új harcos ${idx + 1}`,
  ke: 10,
  te: 30,
  ve: 70,
  ce: 20,
  maxEp: 10,
  ep: 10,
  maxFp: 30,
  fp: 30,
  weapon: {
    name: 'Fegyver',
    category: 3,
    attackMode: 'melee',
    rangeFeet: 0,
    ke: 0,
    te: 0,
    ve: 0,
    ce: 0,
    damage: '1k6',
  },
  armor: {
    name: 'Nincs',
    mgt: 0,
    sfe: 0,
  },
  isPlayerCharacter: partyPrefix === 'a',
  status: 'active',
})

const getInitialScenario = (): Scenario => {
  try {
    return JSON.parse(DEFAULT_SCENARIO) as Scenario
  } catch {
    return {
      partyA: [createEmptyCombatant('a', 0)],
      partyB: [createEmptyCombatant('b', 0)],
      settings: {
        targeting: 'random',
        maxRounds: 100,
        mandatoryEpFromFp: true,
        injuryStatPenalties: true,
        defaultDistanceFeet: 0,
        closeDistancePerRound: 39,
      },
    }
  }
}

type FighterEditorProps = {
  team: TeamSide
  idx: number
  combatant: Combatant
  removable: boolean
  onUpdate: (team: TeamSide, index: number, updater: (prev: Combatant) => Combatant) => void
  onRemove: (team: TeamSide, index: number) => void
}

const FighterEditor = ({
  team,
  idx,
  combatant: c,
  removable,
  onUpdate,
  onRemove,
}: FighterEditorProps) => {
  const weaponPresetListId = `weapon-presets-${team}-${idx}`
  const armorPresetListId = `armor-presets-${team}-${idx}`
  const weaponInputRef = useRef<HTMLInputElement>(null)
  const armorInputRef = useRef<HTMLInputElement>(null)

  const focusAndOpen = (input: HTMLInputElement | null) => {
    if (!input) return
    input.focus()
    try {
      ;(input as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    } catch {
      // showPicker nem minden böngészőben támogatott
    }
  }

  return (
    <div className="fighter-card">
    <div className="fighter-header">
      <strong>
        #{idx + 1} {c.name}
      </strong>
      <button type="button" onClick={() => onRemove(team, idx)} disabled={!removable}>
        Törlés
      </button>
    </div>

    <div className="editor-sections">
      <section className="editor-section basics">
        <h4>Alapadatok</h4>
        <div className="fighter-grid compact">
          <label>
            Név
            <input
              value={c.name}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label>
            Azonosító
            <input
              value={c.id}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, id: e.target.value }))}
            />
          </label>
          <label>
            JK?
            <select
              value={String(c.isPlayerCharacter)}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, isPlayerCharacter: e.target.value === 'true' }))
              }
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>
      </section>

      <section className="editor-section combat">
        <h4>Harcértékek</h4>
        <div className="fighter-grid stats-inline">
          <label>
            KÉ
            <input
              type="number"
              value={c.ke}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, ke: Number(e.target.value) }))}
            />
          </label>
          <label>
            TÉ
            <input
              type="number"
              value={c.te}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, te: Number(e.target.value) }))}
            />
          </label>
          <label>
            VÉ
            <input
              type="number"
              value={c.ve}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, ve: Number(e.target.value) }))}
            />
          </label>
          <label>
            CÉ
            <input
              type="number"
              value={c.ce}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, ce: Number(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="editor-section vitality">
        <h4>Életerő és állapot</h4>
        <div className="fighter-grid stats-inline vitality-row">
          <label>
            Max Ép
            <input
              type="number"
              value={c.maxEp}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, maxEp: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Ép
            <input
              type="number"
              value={c.ep}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, ep: Number(e.target.value) }))}
            />
          </label>
          <label>
            Max Fp
            <input
              type="number"
              value={c.maxFp}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, maxFp: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Fp
            <input
              type="number"
              value={c.fp}
              onChange={(e) => onUpdate(team, idx, (p) => ({ ...p, fp: Number(e.target.value) }))}
            />
          </label>
          <label className="mini-field">
            Állapot
            <select
              value={c.status}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, status: e.target.value as Combatant['status'] }))
              }
            >
              <option value="active">active</option>
              <option value="unconscious">unconscious</option>
              <option value="dead">dead</option>
            </select>
          </label>
        </div>
      </section>

      <section className="editor-section weapon">
        <h4>Fegyver</h4>
        <div className="fighter-grid weapon-main">
          <label>
            Név
            <div className="search-select">
              <input
                ref={weaponInputRef}
                list={weaponPresetListId}
                value={c.weapon.name}
                onChange={(e) => {
                  const selectedName = e.target.value
                  const preset = weaponPresetByName.get(normalizeLookup(selectedName))
                  onUpdate(team, idx, (p) => ({
                    ...p,
                    weapon: preset
                      ? {
                          ...p.weapon,
                          name: preset.name,
                          category: preset.category ?? p.weapon.category,
                          time: typeof preset.time === 'number' ? preset.time : p.weapon.time,
                          rangeFeet: preset.rangeFeet ?? p.weapon.rangeFeet ?? 0,
                          attackMode: deriveAttackMode(preset.rangeFeet ?? p.weapon.rangeFeet ?? 0),
                          damage: preset.damage,
                          ke: preset.ke ?? p.weapon.ke,
                          te: preset.te ?? p.weapon.te,
                          ve: preset.ve ?? p.weapon.ve,
                          ce: preset.ce ?? p.weapon.ce,
                        }
                      : { ...p.weapon, name: selectedName },
                  }))
                }}
              />
              <button
                type="button"
                className="dropdown-trigger"
                aria-label="Fegyver lista megnyitása"
                onClick={() => {
                  onUpdate(team, idx, (p) => ({ ...p, weapon: { ...p.weapon, name: '' } }))
                  requestAnimationFrame(() => focusAndOpen(weaponInputRef.current))
                }}
              >
                ▾
              </button>
            </div>
            <datalist id={weaponPresetListId}>
              {weaponPresetNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="mini-field">
            Kategória
            <select
              value={String(c.weapon.category)}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({
                  ...p,
                  weapon: { ...p.weapon, category: Number(e.target.value) as Combatant['weapon']['category'] },
                }))
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <label className="mini-field">
            Hatótáv
            <input
              type="number"
              min={0}
              value={c.weapon.rangeFeet ?? 0}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({
                  ...p,
                  weapon: {
                    ...p.weapon,
                    rangeFeet: Number(e.target.value),
                    attackMode: deriveAttackMode(Number(e.target.value)),
                  },
                }))
              }
            />
          </label>
        </div>
        <div className="fighter-grid stats-inline weapon-stats">
          <label className="damage-field">
            Sebzés
            <input
              value={c.weapon.damage}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({
                  ...p,
                  weapon: { ...p.weapon, damage: e.target.value },
                }))
              }
            />
          </label>
          <label>
            KÉ
            <input
              type="number"
              value={c.weapon.ke}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, weapon: { ...p.weapon, ke: Number(e.target.value) } }))
              }
            />
          </label>
          <label>
            TÉ
            <input
              type="number"
              value={c.weapon.te}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, weapon: { ...p.weapon, te: Number(e.target.value) } }))
              }
            />
          </label>
          <label>
            VÉ
            <input
              type="number"
              value={c.weapon.ve}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, weapon: { ...p.weapon, ve: Number(e.target.value) } }))
              }
            />
          </label>
          <label>
            CÉ
            <input
              type="number"
              value={c.weapon.ce}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, weapon: { ...p.weapon, ce: Number(e.target.value) } }))
              }
            />
          </label>
        </div>
      </section>

      <section className="editor-section armor">
        <h4>Páncél</h4>
        <div className="fighter-grid armor-main">
          <label>
            Név
            <div className="search-select">
              <input
                ref={armorInputRef}
                list={armorPresetListId}
                value={c.armor.name}
                onChange={(e) => {
                  const selectedName = e.target.value
                  const preset = armorPresetByName.get(normalizeLookup(selectedName))
                  onUpdate(team, idx, (p) => ({
                    ...p,
                    armor: preset
                      ? {
                          ...p.armor,
                          name: preset.name,
                          mgt: preset.mgt,
                          sfe: preset.sfe,
                        }
                      : { ...p.armor, name: selectedName },
                  }))
                }}
              />
              <button
                type="button"
                className="dropdown-trigger"
                aria-label="Páncél lista megnyitása"
                onClick={() => {
                  onUpdate(team, idx, (p) => ({ ...p, armor: { ...p.armor, name: '' } }))
                  requestAnimationFrame(() => focusAndOpen(armorInputRef.current))
                }}
              >
                ▾
              </button>
            </div>
            <datalist id={armorPresetListId}>
              {armorPresetNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="mini-field">
            SFÉ
            <input
              type="number"
              value={c.armor.sfe}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, armor: { ...p.armor, sfe: Number(e.target.value) } }))
              }
            />
          </label>
          <label className="mini-field">
            MGT
            <input
              type="number"
              value={c.armor.mgt}
              onChange={(e) =>
                onUpdate(team, idx, (p) => ({ ...p, armor: { ...p.armor, mgt: Number(e.target.value) } }))
              }
            />
          </label>
        </div>
      </section>
    </div>
  </div>
  )
}

type TeamEditorProps = {
  team: TeamSide
  title: string
  members: Combatant[]
  onUpdate: (team: TeamSide, index: number, updater: (prev: Combatant) => Combatant) => void
  onRemove: (team: TeamSide, index: number) => void
  onAdd: (team: TeamSide) => void
}

const TeamEditor = ({ team, title, members, onUpdate, onRemove, onAdd }: TeamEditorProps) => (
  <section className="panel team-editor">
    <h3>{title}</h3>
    {members.map((c, idx) => (
      <FighterEditor
        key={c.id}
        team={team}
        idx={idx}
        combatant={c}
        removable={members.length > 1}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
    ))}
    <button type="button" onClick={() => onAdd(team)}>
      + Harcos hozzáadása ({team.toUpperCase()})
    </button>
  </section>
)

type TargetMappingEditorProps = {
  rows: Array<{ id: string; name: string; party: Party; targetId?: string }>
  onChangeTarget: (combatantId: string, targetId?: string) => void
  title?: string
  description?: string
  asSection?: boolean
}

const TargetMappingEditor = ({
  rows,
  onChangeTarget,
  title = 'Célpont-hozzárendelés',
  description = 'Itt adhatod meg egyszerűen, hogy ki kit támadjon. A harcoskártyákban már nincs külön célpont mező.',
  asSection = true,
}: TargetMappingEditorProps) => {
  const content = (
    <>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      <div className="target-map-grid">
        {rows.map((row) => {
          const enemyParty = getOpposingParty(row.party)
          const enemyCandidates = rows.filter((candidate) => candidate.party === enemyParty)
          return (
            <label key={row.id}>
              {row.name} ({row.party.toUpperCase()})
              <select
                value={row.targetId ?? ''}
                onChange={(e) => onChangeTarget(row.id, e.target.value || undefined)}
              >
                <option value="">— automatikus célválasztás —</option>
                {enemyCandidates.map((enemy) => (
                  <option key={enemy.id} value={enemy.id}>
                    {enemy.name} ({enemy.id})
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
    </>
  )

  if (!asSection) return <div className="target-mapping-editor">{content}</div>
  return <section className="panel target-mapping-editor">{content}</section>
}

type RuleDeclarationEditorProps = {
  declarations: DeclaredCombatRule[]
  combatants: Array<{ id: string; name: string; party: Party }>
  onChange: (declarationId: string, patch: Partial<DeclaredCombatRule>) => void
  onAdd: () => void
  onRemove: (declarationId: string) => void
}

const RuleDeclarationEditor = ({
  declarations,
  combatants,
  onChange,
  onAdd,
  onRemove,
}: RuleDeclarationEditorProps) => {
  const combatantById = new Map(combatants.map((c) => [c.id, c]))
  return (
    <section className="panel">
      <h3>Speciális harci helyzetek</h3>
      <p className="muted">
        A jelenlegi csapatállapot alapján itt adhatod meg, hogy melyik harcosra legyen érvényes speciális
        helyzet a következő körben (pl. roham, meglepetés).
      </p>
      <div className="decl-rules">
        {declarations.map((decl) => {
          const source = combatantById.get(decl.sourceId)
          return (
            <div className="decl-rule-row" key={decl.id}>
              <label>
                Forrás (X)
                <select
                  value={decl.sourceId}
                  onChange={(e) => onChange(decl.id, { sourceId: e.target.value })}
                >
                  <option value="">—</option>
                  {combatants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.party.toUpperCase()})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Szabály
                <select
                  value={decl.ruleId}
                  onChange={(e) => onChange(decl.id, { ruleId: e.target.value as DeclaredCombatRuleId })}
                >
                  {DECLARED_COMBAT_RULE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="decl-rule-actions">
                <button type="button" onClick={() => onRemove(decl.id)}>
                  Törlés
                </button>
                {source && <span className="muted">{source.name}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" onClick={onAdd}>
        + Szabály hozzáadása
      </button>
    </section>
  )
}

export default function App() {
  const initialScenario = getInitialScenario()
  const [activeInputTab, setActiveInputTab] = useState<'builder' | 'json'>('builder')
  const [scenarioText, setScenarioText] = useState(DEFAULT_SCENARIO)
  const [teamA, setTeamA] = useState<Combatant[]>(initialScenario.partyA)
  const [teamB, setTeamB] = useState<Combatant[]>(initialScenario.partyB)
  const [declaredRules, setDeclaredRules] = useState<DeclaredCombatRule[]>([])
  const [targeting, setTargeting] = useState(
    initialScenario.settings?.targeting ?? 'random',
  )
  const [mandatoryEpFromFp, setMandatoryEpFromFp] = useState(
    initialScenario.settings?.mandatoryEpFromFp ?? true,
  )
  const [injuryStatPenalties, setInjuryStatPenalties] = useState(
    initialScenario.settings?.injuryStatPenalties ?? true,
  )
  const [maxRounds, setMaxRounds] = useState(100)
  const [defaultDistanceFeet, setDefaultDistanceFeet] = useState(
    initialScenario.settings?.defaultDistanceFeet ?? 0,
  )
  const [closeDistancePerRound, setCloseDistancePerRound] = useState(
    initialScenario.settings?.closeDistancePerRound ?? 39,
  )
  const [diceQueueInput, setDiceQueueInput] = useState('')
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [roundCursor, setRoundCursor] = useState(1)
  const [shownTargetMappingsByRound, setShownTargetMappingsByRound] = useState<Record<number, boolean>>({})
  const [roundTargetOverridesByRound, setRoundTargetOverridesByRound] = useState<
    Record<number, Record<string, string | undefined>>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [runState, setRunState] = useState<RunState | null>(null)

  const diceQueue = useMemo(
    () =>
      diceQueueInput
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0),
    [diceQueueInput],
  )

  const declarationCombatants = useMemo(
    () => [
      ...teamA.map((c) => ({ id: c.id, name: c.name, party: 'a' as const })),
      ...teamB.map((c) => ({ id: c.id, name: c.name, party: 'b' as const })),
    ],
    [teamA, teamB],
  )

  const mappingRows = useMemo(
    () => [
      ...teamA.map((c) => ({ id: c.id, name: c.name, party: 'a' as const, targetId: c.targetId })),
      ...teamB.map((c) => ({ id: c.id, name: c.name, party: 'b' as const, targetId: c.targetId })),
    ],
    [teamA, teamB],
  )

  const updateCombatant = (
    team: TeamSide,
    index: number,
    updater: (prev: Combatant) => Combatant,
  ) => {
    const setter = team === 'a' ? setTeamA : setTeamB
    setter((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c
        const updated = updater(c)
        return {
          ...updated,
          weapon: {
            ...updated.weapon,
            attackMode: deriveAttackMode(updated.weapon.rangeFeet),
          },
        }
      }),
    )
  }

  const removeCombatant = (team: TeamSide, index: number) => {
    const setter = team === 'a' ? setTeamA : setTeamB
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  const addCombatant = (team: TeamSide) => {
    const setter = team === 'a' ? setTeamA : setTeamB
    setter((prev) => [...prev, createEmptyCombatant(team, prev.length)])
  }

  const setCombatantTarget = (combatantId: string, targetId?: string) => {
    setTeamA((prev) => prev.map((c) => (c.id === combatantId ? { ...c, targetId } : c)))
    setTeamB((prev) => prev.map((c) => (c.id === combatantId ? { ...c, targetId } : c)))
  }

  const updateDeclaredRule = (declarationId: string, patch: Partial<DeclaredCombatRule>) => {
    setDeclaredRules((prev) => prev.map((rule) => (rule.id === declarationId ? { ...rule, ...patch } : rule)))
  }

  const removeDeclaredRule = (declarationId: string) => {
    setDeclaredRules((prev) => prev.filter((rule) => rule.id !== declarationId))
  }

  const addDeclaredRule = () => {
    setDeclaredRules((prev) => [...prev, createEmptyDeclaredRule()])
  }

  const buildScenarioFromBuilder = (): Scenario => ({
    partyA: teamA,
    partyB: teamB,
    settings: {
      targeting,
      maxRounds,
      mandatoryEpFromFp,
      injuryStatPenalties,
      defaultDistanceFeet,
      closeDistancePerRound,
    },
  })

  const promptForTargetReassignments = (
    encounter: ReturnType<typeof createEncounter>,
    stateBeforeRound: ReturnType<ReturnType<typeof createEncounter>['getState']>,
    encounterState: ReturnType<ReturnType<typeof createEncounter>['getState']>,
  ) => {
    const all = [...encounterState.partyA, ...encounterState.partyB]
    const beforeAll = [...stateBeforeRound.partyA, ...stateBeforeRound.partyB]
    const byId = new Map(all.map((c) => [c.id, c]))
    const beforeById = new Map(beforeAll.map((c) => [c.id, c]))

    for (const combatant of all) {
      if (combatant.status !== 'active' || !combatant.targetId) continue
      const previousCombatant = beforeById.get(combatant.id)
      const previousTargetId = previousCombatant?.targetId
      if (!previousTargetId || previousTargetId !== combatant.targetId) continue

      const previousTarget = beforeById.get(previousTargetId)
      if (!previousTarget || previousTarget.status !== 'active') continue

      const currentTarget = byId.get(combatant.targetId)
      if (currentTarget && currentTarget.status === 'active') continue

      const enemyParty = getOpposingParty(combatant.party)
      const enemyCandidates = all.filter((c) => c.party === enemyParty && c.status === 'active')

      if (enemyCandidates.length === 0) {
        setCombatantTarget(combatant.id, undefined)
        continue
      }

      const optionsText = enemyCandidates
        .map((candidate, index) => `${index + 1}: ${candidate.name} (${candidate.id})`)
        .join('\n')
      const answer = window.prompt(
        `${combatant.name} (${combatant.id}) célpontja kiesett (${currentTarget?.status ?? 'nincs'}).\n` +
          `Válassz új célpontot:\n${optionsText}\n\n` +
          `Adj meg sorszámot 1-${enemyCandidates.length}, vagy hagyd üresen az automatikus célválasztáshoz.`,
        '',
      )

      const selected = Number(answer)
      const nextTargetId =
        Number.isFinite(selected) && selected >= 1 && selected <= enemyCandidates.length
          ? enemyCandidates[selected - 1].id
          : undefined

      setCombatantTarget(combatant.id, nextTargetId)
      encounter.modifyCombatant(combatant.id, { targetId: nextTargetId })
      encounterState = {
        ...encounterState,
        partyA: encounterState.partyA.map((c) => (c.id === combatant.id ? { ...c, targetId: nextTargetId } : c)),
        partyB: encounterState.partyB.map((c) => (c.id === combatant.id ? { ...c, targetId: nextTargetId } : c)),
      }
    }
  }

  const runBattle = () => {
    try {
      setError(null)
      const raw =
        activeInputTab === 'json'
          ? (JSON.parse(scenarioText) as unknown)
          : (buildScenarioFromBuilder() as unknown)
      const parsed = parseScenario(raw)
      const roundLimit = Math.min(maxRounds, parsed.maxRounds)
      const validIds = new Set([...parsed.partyA, ...parsed.partyB].map((combatant) => combatant.id))
      const validDeclaredRules = declaredRules.filter(
        (rule) => validIds.has(rule.sourceId),
      )
      const ruleHooks = createDeclaredCombatRuleHooks(validDeclaredRules)

      let rollerIdx = 0
      const roller = (sides: number): number => {
        if (rollerIdx < diceQueue.length) return diceQueue[rollerIdx++]
        return Math.floor(Math.random() * sides) + 1
      }

      const encounter = createEncounter(parsed.partyA, parsed.partyB, {
        ...parsed.options,
        roller,
        ruleHooks,
      })
      const initial = encounter.getState()
      const rounds: RoundResult[] = []
      while (!encounter.isOver() && rounds.length < roundLimit) {
        const stateBeforeRound = encounter.getState()
        const next = encounter.nextRound()
        rounds.push(next)
        const stateAfterRound = encounter.getState()
        if (!interactiveMode) {
          promptForTargetReassignments(encounter, stateBeforeRound, stateAfterRound)
        }
      }
      const result: EncounterResult = { rounds, winner: encounter.getState().winner }
      setRunState({
        initialA: initial.partyA,
        initialB: initial.partyB,
        initialDistances: initial.distances,
        roundDistances: buildRoundDistances(initial.distances, result.rounds),
        result,
      })
      setShownTargetMappingsByRound({})
      setRoundTargetOverridesByRound({})
      setRoundCursor(1)
    } catch (e) {
      setRunState(null)
      setError((e as Error).message)
    }
  }

  return (
    <main className="app">
      <h1>M.A.G.U.S. Csataszimulátor</h1>
      <p className="muted">
        Harcrendszer szimulátor a M.A.G.U.S. UTK szabálykönyv alapján.
      </p>

      <section className="panel">
        <h2>Bemenet</h2>
        <div className="tabs">
          <button
            className={`tab-btn ${activeInputTab === 'builder' ? 'active' : ''}`}
            onClick={() => setActiveInputTab('builder')}
            type="button"
          >
            Csapatépítő
          </button>
          <button
            className={`tab-btn ${activeInputTab === 'json' ? 'active' : ''}`}
            onClick={() => setActiveInputTab('json')}
            type="button"
          >
            Forgatókönyv JSON
          </button>
        </div>

        {activeInputTab === 'builder' ? (
          <div className="builder-wrap">
            <div className="builder-settings">
              <label>
                Célválasztási stratégia
                <select value={targeting} onChange={(e) => setTargeting(e.target.value)}>
                  <option value="random">Véletlen (random)</option>
                  <option value="weakest">Leggyengébb (weakest)</option>
                  <option value="strongest">Legerősebb (strongest)</option>
                </select>
                <div className="inline-setting">
                  <input
                    type="checkbox"
                    checked={mandatoryEpFromFp}
                    onChange={(e) => setMandatoryEpFromFp(e.target.checked)}
                  />
                  Kötelező Ép veszteség (minden 5 Fp után 1 Ép)
                </div>
                <div className="inline-setting">
                  <input
                    type="checkbox"
                    checked={injuryStatPenalties}
                    onChange={(e) => setInjuryStatPenalties(e.target.checked)}
                  />
                  Sérülési harcérték-módosítók (Ép/Fp veszteség alapján)
                </div>
                <div className="inline-setting">
                  <label>
                    Kezdő távolság (láb)
                    <input
                      type="number"
                      min={0}
                      value={defaultDistanceFeet}
                      onChange={(e) => setDefaultDistanceFeet(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="inline-setting">
                  <label>
                    Zárkózás/kör (láb)
                    <input
                      type="number"
                      min={0}
                      value={closeDistancePerRound}
                      onChange={(e) => setCloseDistancePerRound(Number(e.target.value))}
                    />
                  </label>
                </div>
              </label>
            </div>

            <div className="grid">
              <TeamEditor
                team="a"
                title="A csapat"
                members={teamA}
                onUpdate={updateCombatant}
                onRemove={removeCombatant}
                onAdd={addCombatant}
              />
              <TeamEditor
                team="b"
                title="B csapat"
                members={teamB}
                onUpdate={updateCombatant}
                onRemove={removeCombatant}
                onAdd={addCombatant}
              />
            </div>
            <TargetMappingEditor rows={mappingRows} onChangeTarget={setCombatantTarget} />
            <RuleDeclarationEditor
              declarations={declaredRules}
              combatants={declarationCombatants}
              onChange={updateDeclaredRule}
              onAdd={addDeclaredRule}
              onRemove={removeDeclaredRule}
            />
          </div>
        ) : (
          <label>
            JSON
            <textarea
              value={scenarioText}
              onChange={(e) => setScenarioText(e.target.value)}
              rows={16}
              spellCheck={false}
            />
          </label>
        )}

        <div className="controls">
          <label>
            Max kör
            <input
              type="number"
              min={1}
              value={maxRounds}
              onChange={(e) => setMaxRounds(Number(e.target.value))}
            />
          </label>
          <label>
            Előre megadott dobások (szóköz / vessző)
            <input
              type="text"
              value={diceQueueInput}
              onChange={(e) => setDiceQueueInput(e.target.value)}
              placeholder="45 78 12"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={interactiveMode}
              onChange={(e) => setInteractiveMode(e.target.checked)}
            />
            Interaktív körnézet (egy kör egyszerre)
          </label>
          <button onClick={runBattle}>Csata futtatása</button>
        </div>
      </section>

      {error && <div className="error">Hiba: {error}</div>}

      {runState && (
        <>
          <section className="grid">
            <PartyTable
              title="A csapat (kezdő állapot)"
              party={runState.initialA}
              allCombatants={[...runState.initialA, ...runState.initialB]}
              distances={runState.initialDistances}
            />
            <PartyTable
              title="B csapat (kezdő állapot)"
              party={runState.initialB}
              allCombatants={[...runState.initialA, ...runState.initialB]}
              distances={runState.initialDistances}
            />
          </section>

          <section className="panel">
            <h2>Végeredmény</h2>
            <p className="result-line">
              Körök száma: {runState.result.rounds.length} | Győztes:{' '}
              <strong className={`winner ${runState.result.winner ?? 'none'}`}>{runState.result.winner ?? 'nincs'}</strong>
            </p>
          </section>

          {(interactiveMode
            ? runState.result.rounds.filter((r) => r.round === roundCursor)
            : runState.result.rounds
          ).map((round: RoundResult) => (
            <section className="panel" key={round.round}>
              {(() => {
                const effectiveTargets = getRoundEffectiveTargetMap(round.events)
                return (
                  <>
              <h2>{round.round}. kör</h2>
              <InitiativeList entries={round.initiatives} />
              {roundDistancePairs(round.stateAfter, runState.roundDistances[round.round]).length > 0 && (
                <div className="round-subtitle">
                  Távolságok:{' '}
                  {roundDistancePairs(round.stateAfter, runState.roundDistances[round.round])
                    .map(({ left, right, distanceFeet }) => `${left.name} ↔ ${right.name}: ${distanceFeet} láb`)
                    .join(', ')}
                </div>
              )}
              {Object.values(round.outnumberedPenalties).some((v) => v > 0) && (
                <div className="round-subtitle">
                  Túlerő VÉ-levonás:{' '}
                  {Object.entries(round.outnumberedPenalties)
                    .filter(([, v]) => v > 0)
                    .map(([id, pen]) => `${id} -${pen}`)
                    .join(', ')}
                </div>
              )}
              <div className="round-subtitle">Események: {round.events.length}</div>
              {round.events.length === 0 && <p>Nincs támadási esemény ebben a körben.</p>}
              {Array.from(
                round.events.reduce((map, e) => {
                  const list = map.get(e.segment) ?? []
                  list.push(e)
                  map.set(e.segment, list)
                  return map
                }, new Map<number, CombatEvent[]>()),
              )
                .sort((a, b) => a[0] - b[0])
                .map(([segment, events]) => (
                  <div key={segment} className="segment-block">
                    <h4>📍 Szegmens {segment}</h4>
                    <div className="events">
                      {events.map((e, idx) => (
                        <EventCard key={`${round.round}-${segment}-${idx}`} e={e} />
                      ))}
                    </div>
                  </div>
                ))}

              <button
                type="button"
                className="toggle-target-map-btn"
                onClick={() =>
                  setShownTargetMappingsByRound((prev) => ({
                    ...prev,
                    [round.round]: !prev[round.round],
                  }))
                }
              >
                {shownTargetMappingsByRound[round.round]
                  ? 'Célpont-hozzárendelés elrejtése'
                  : 'Célpont-hozzárendelés megjelenítése'}
              </button>
              {shownTargetMappingsByRound[round.round] && (
                <div className="round-target-map">
                  {roundTargetAssignments(round.stateAfter).length === 0 ? (
                    <p className="muted">Ebben a körben nincs rögzített célpont-hozzárendelés.</p>
                  ) : (
                    <TargetMappingEditor
                      asSection={false}
                      title="Célpont-hozzárendelés (következő kör)"
                      description="Itt átállíthatod a célpontokat a következő futtatáshoz/körhöz."
                      rows={round.stateAfter.map((c) => ({
                        id: c.id,
                        name: c.name,
                        party: c.party,
                        targetId: roundTargetOverridesByRound[round.round]?.[c.id] ?? c.targetId,
                      }))}
                      onChangeTarget={(combatantId, targetId) => {
                        setRoundTargetOverridesByRound((prev) => ({
                          ...prev,
                          [round.round]: {
                            ...(prev[round.round] ?? {}),
                            [combatantId]: targetId,
                          },
                        }))
                        setCombatantTarget(combatantId, targetId)
                      }}
                    />
                  )}
                </div>
              )}

              <div className="grid">
                <PartyTable
                  title="A csapat kör végi állapot"
                  party={splitByParty(round.stateAfter).a}
                  allCombatants={round.stateAfter}
                  distances={runState.roundDistances[round.round]}
                  effectiveTargets={effectiveTargets}
                />
                <PartyTable
                  title="B csapat kör végi állapot"
                  party={splitByParty(round.stateAfter).b}
                  allCombatants={round.stateAfter}
                  distances={runState.roundDistances[round.round]}
                  effectiveTargets={effectiveTargets}
                />
              </div>
                  </>
                )
              })()}
            </section>
          ))}

          {interactiveMode && runState.result.rounds.length > 0 && (
            <div className="interactive-bottom-nav">
              <div className="bottom-nav-inner">
                <span>
                  Kör: {Math.min(roundCursor, runState.result.rounds.length)} / {runState.result.rounds.length}
                </span>
                <div className="bottom-nav-actions">
                  <button
                    onClick={() => setRoundCursor((v) => Math.max(1, v - 1))}
                    disabled={roundCursor <= 1}
                  >
                    Előző kör
                  </button>
                  <button
                    onClick={() =>
                      setRoundCursor((v) => Math.min(runState.result.rounds.length, v + 1))
                    }
                    disabled={roundCursor >= runState.result.rounds.length}
                  >
                    Következő kör
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
