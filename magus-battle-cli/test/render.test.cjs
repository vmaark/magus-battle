const test = require('node:test')
const assert = require('node:assert/strict')
const { renderRound } = require('../dist/render.js')

test('renderRound megjeleniti az akciohoz tartozo szabaly-magyarazatokat', () => {
  const round = {
    round: 1,
    initiatives: [
      { combatantId: 'a', name: 'A', die: 7, total: 17, lostInitiative: false },
      { combatantId: 'b', name: 'B', die: 4, total: 14, lostInitiative: false },
    ],
    outnumberedPenalties: {},
    events: [
      {
        round: 1,
        segment: 5,
        attackerId: 'a',
        attackerName: 'A',
        attackerWeapon: { name: 'Kard', category: 3, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k6' },
        defenderId: 'b',
        defenderName: 'B',
        roll: 50,
        attackTotal: 130,
        attackerTeTotal: 80,
        defenderVe: 95,
        hit: true,
        automaticHit: false,
        automaticFatal: false,
        criticalHit: false,
        criticalMiss: false,
        overthit: false,
        rawDamage: 5,
        damage: 3,
        fpLoss: 3,
        epLoss: 0,
        defenderFpAfter: 7,
        defenderEpAfter: 10,
        defenderStatusAfter: 'active',
        appliedRules: [
          {
            ref: { code: 'HR-11-OUTNUMBERED', source: 'harcrendszer', section: '§11' },
            explanation: 'Túlerő miatt a védő VÉ-je 5 ponttal csökkent.',
          },
        ],
      },
    ],
    stateAfter: [
      {
        id: 'a',
        name: 'A',
        party: 'a',
        ke: 10,
        te: 80,
        ve: 90,
        fp: 10,
        maxFp: 10,
        ep: 10,
        maxEp: 10,
        status: 'active',
        weapon: { name: 'Kard', category: 3, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k6' },
        armor: { name: 'Nincs', sfe: 0 },
      },
      {
        id: 'b',
        name: 'B',
        party: 'b',
        ke: 10,
        te: 80,
        ve: 90,
        fp: 7,
        maxFp: 10,
        ep: 10,
        maxEp: 10,
        status: 'active',
        weapon: { name: 'Kard', category: 3, ke: 0, te: 0, ve: 0, ce: 0, damage: '1k6' },
        armor: { name: 'Nincs', sfe: 0 },
      },
    ],
  }

  const output = renderRound(round)
  assert.match(output, /Szabályok:/)
  assert.match(output, /HR-11-OUTNUMBERED/)
  assert.match(output, /Túlerő miatt a védő VÉ-je 5 ponttal csökkent/)
})
