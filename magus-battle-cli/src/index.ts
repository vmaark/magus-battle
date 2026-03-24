import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Command } from 'commander'
import { createEncounter, defaultRoller } from 'magus-battle-simulator'
import type { DiceRoller, RoundResult } from 'magus-battle-simulator'
import { parseScenario } from './scenario'
import { renderHeader, renderParty, renderRound, renderResult } from './render'

const program = new Command()

program
  .name('magus-csata')
  .description('M.A.G.U.S. harci szimulátor – ütközeteket szimulál a hivatalos szabályok alapján')
  .version('0.1.0')

program
  .command('csata <forgatokonyv>', { isDefault: true })
  .description('Ütközet futtatása forgatókönyv-fájlból')
  .option('-k, --max-kor <szam>', 'Maximum körök száma', '100')
  .option('-i, --interaktiv', 'Interaktív mód: köronként megáll és vár')
  .option(
    '-d, --dobas <dobas...>',
    'Előre meghatározott dobások (fizikai kocka), pl. --dobas 45 78 12',
  )
  .action(async (fajl: string, opts: { maxKor: string; interaktiv?: boolean; dobas?: string[] }) => {
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(resolve(process.cwd(), fajl), 'utf-8'))
    } catch (err) {
      console.error(`Hiba a forgatókönyv olvasásakor: ${(err as Error).message}`)
      process.exit(1)
    }

    let scenario
    try {
      scenario = parseScenario(raw)
    } catch (err) {
      console.error(`Érvénytelen forgatókönyv: ${(err as Error).message}`)
      process.exit(1)
    }

    const { partyA, partyB, options, maxRounds } = scenario
    const limit = Math.min(parseInt(opts.maxKor, 10), maxRounds)

    // Kockadobó: fizikai kockák sorba rendezve, ha meg vannak adva
    let roller: DiceRoller = defaultRoller
    if (opts.dobas && opts.dobas.length > 0) {
      const queue = opts.dobas.map(Number)
      let idx = 0
      roller = (sides) => (idx < queue.length ? queue[idx++] : defaultRoller(sides))
    }

    const encounter = createEncounter(partyA, partyB, { ...options, roller })
    const initialState = encounter.getState()

    console.log(renderHeader('A csapat', 'B csapat', partyA.length, partyB.length))
    console.log(renderParty('A csapat harcosai', initialState.partyA))
    console.log(renderParty('B csapat harcosai', initialState.partyB))

    const completedRounds: RoundResult[] = []

    if (opts.interaktiv) {
      const readline = await import('readline')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const wait = (): Promise<void> =>
        new Promise(res => rl.question('\n  [Enter] következő kör... ', () => res()))

      while (!encounter.isOver() && completedRounds.length < limit) {
        await wait()
        const round = encounter.nextRound()
        completedRounds.push(round)
        console.log(renderRound(round))
      }
      rl.close()
    } else {
      const result = encounter.run(limit)
      completedRounds.push(...result.rounds)
      for (const round of result.rounds) console.log(renderRound(round))
    }

    console.log(renderResult({ rounds: completedRounds, winner: encounter.getState().winner }))
  })

program.parse(process.argv)
