/**
 * Offline neuroevolution harness. Evolves a competent founder brain and bakes the winner into
 * src/sim/brain/brainSeed.ts, so the live sim starts with creatures that forage and dodge deep
 * water instead of flailing. Run with: npm run evolve:brain
 *
 * This is a headless GA over the brain-weight genome only. Fitness rewards a lineage that keeps a
 * living, reproducing population out of the water over a fixed run.
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrainDNA } from '../src/sim/brain/brainGenome.ts'

// In-memory localStorage stub so world modules that lazily touch storage don't crash under Node.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage

const { World } = await import('../src/sim/world.ts')
const { DEFAULT_SIM_SETTINGS } = await import('../src/sim/simSettings.ts')
const { Rng } = await import('../src/sim/rng.ts')
const {
  BRAIN_GENOME_LENGTH,
  createRandomBrainDna,
  crossoverBrainDna,
  mutateBrainDna,
} = await import('../src/sim/brain/brainGenome.ts')

type SimSettings = typeof DEFAULT_SIM_SETTINGS

const num = (key: string, fallback: number): number => {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

const POP = num('BRAIN_POP', 28)
const GENERATIONS = num('BRAIN_GENS', 30)
const ELITES = num('BRAIN_ELITES', 5)
const EVAL_TICKS = num('BRAIN_TICKS', 900)
const SAMPLE_EVERY = 5
const EVAL_SEEDS = (process.env.BRAIN_SEEDS ?? '101,202')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n))

function evalSettings(): SimSettings {
  return {
    ...DEFAULT_SIM_SETTINGS,
    worldWidth: 1000,
    worldHeight: 720,
    creatureGroups: 1,
    herbivoresPerGroup: 26,
    creatureFirstSpawnDelayYears: 0,
    initialPlants: 140,
    // A central pond that is a real but avoidable drowning hazard, with plenty of dry land around.
    pondBaseRadius: 90,
    pondMaxDepth: 40,
    respawnBestPlantSpecies: false,
    respawnBestPathogen: false,
    pathogenChampionSpawnChance: 0,
    groupFounders: DEFAULT_SIM_SETTINGS.groupFounders.map(() => ''),
    brainControlEnabled: true,
  }
}

function evaluateOnce(brain: BrainDNA, seed: number, settings: SimSettings): number {
  const world = new World(seed, settings)
  world.setFounderBrainDna(brain)
  world.reset(seed, settings)

  let popSum = 0
  let samples = 0
  for (let t = 0; t < EVAL_TICKS; t++) {
    world.tick()
    if (t % SAMPLE_EVERY === 0) {
      popSum += world.snapshot().stats.herbivoreCount
      samples += 1
    }
  }
  const stats = world.snapshot().stats
  const avgPop = popSum / Math.max(samples, 1)
  const drown = stats.deathCauseCounts.drowning ?? 0
  const births = stats.births
  return avgPop + births * 1.5 - drown * 2.0
}

function fitness(brain: BrainDNA, settings: SimSettings): number {
  let sum = 0
  for (const seed of EVAL_SEEDS) sum += evaluateOnce(brain, seed, settings)
  return sum / EVAL_SEEDS.length
}

function main(): void {
  const settings = evalSettings()
  const rng = new Rng(20260707)

  let population: BrainDNA[] = Array.from({ length: POP }, () => createRandomBrainDna(rng))
  let best: { brain: BrainDNA; score: number } | null = null

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const scored = population
      .map((brain) => ({ brain, score: fitness(brain, settings) }))
      .sort((a, b) => b.score - a.score)

    if (!best || scored[0].score > best.score) {
      best = { brain: scored[0].brain, score: scored[0].score }
    }

    const mean = scored.reduce((acc, s) => acc + s.score, 0) / scored.length
    console.log(
      `gen ${String(gen + 1).padStart(2)}/${GENERATIONS}  best=${scored[0].score.toFixed(1)}  mean=${mean.toFixed(1)}  allTimeBest=${best.score.toFixed(1)}`,
    )

    const next: BrainDNA[] = scored.slice(0, ELITES).map((s) => s.brain)
    const breedPool = scored.slice(0, Math.max(ELITES, Math.floor(POP / 2)))
    while (next.length < POP) {
      const a = rng.pick(breedPool).brain
      const b = rng.pick(breedPool).brain
      next.push(mutateBrainDna(crossoverBrainDna(a, b, rng), rng))
    }
    population = next
  }

  if (!best) throw new Error('no best brain produced')
  writeSeed(best.brain, best.score)
  console.log(`\nBaked winning brain (score ${best.score.toFixed(1)}) into src/sim/brain/brainSeed.ts`)
}

function writeSeed(brain: BrainDNA, score: number): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const target = resolve(here, '../src/sim/brain/brainSeed.ts')
  const values = Array.from(brain)
  const rows: string[] = []
  for (let i = 0; i < values.length; i += 16) {
    rows.push('  ' + values.slice(i, i + 16).join(', ') + ',')
  }

  const file = `import { normalizeBrainDna, type BrainDNA } from './brainGenome'
import type { Rng } from '../rng'

/**
 * Founder behavior genome. Produced by the offline evolution harness (\`npm run evolve:brain\`) and
 * baked in here so the live sim starts with creatures that already forage and avoid deep water,
 * instead of flailing randomly. Regenerate by re-running the harness; it overwrites this array.
 *
 * Last harness score: ${score.toFixed(1)} (length ${values.length}, expected ${BRAIN_GENOME_LENGTH}).
 */
export const SEED_BRAIN_DNA: readonly number[] = [
${rows.join('\n')}
]

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function seedBrainDna(): BrainDNA {
  return normalizeBrainDna(Uint8Array.from(SEED_BRAIN_DNA))
}

/** A founder's brain: the baked seed with small jitter so a group isn't behaviorally identical. */
export function createSeedBrainDna(rng: Rng, jitter = 10): BrainDNA {
  const dna = seedBrainDna()
  if (jitter > 0) {
    for (let i = 0; i < dna.length; i++) {
      dna[i] = clampByte(dna[i] + rng.int(-jitter, jitter))
    }
  }
  return dna
}
`
  writeFileSync(target, file, 'utf8')
}

main()
