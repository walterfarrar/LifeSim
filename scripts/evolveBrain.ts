/**
 * Offline neuroevolution harness. Evolves a competent founder brain and bakes the winner into
 * src/sim/brain/brainSeed.ts, so the live sim starts with creatures that forage, hydrate, and
 * reproduce instead of flailing. Run with: npm run evolve:brain
 *
 * This is a headless GA over the brain-weight genome only — pure local CPU, no network/AI.
 * Fitness rewards a living population with energy surplus, matings/births, and low thirst deaths.
 *
 * Env knobs (all optional):
 *   BRAIN_POP=28  BRAIN_GENS=30  BRAIN_ELITES=5  BRAIN_TICKS=1200  BRAIN_SEEDS=101,202
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
  cloneBrainDna,
  createRandomBrainDna,
  crossoverBrainDna,
  mutateBrainDna,
} = await import('../src/sim/brain/brainGenome.ts')
const { seedBrainDna } = await import('../src/sim/brain/brainSeed.ts')
const { reproduceModeThreshold } = await import('../src/sim/entities/creature.ts')

type SimSettings = typeof DEFAULT_SIM_SETTINGS

const num = (key: string, fallback: number): number => {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

const POP = num('BRAIN_POP', 28)
const GENERATIONS = num('BRAIN_GENS', 30)
const ELITES = num('BRAIN_ELITES', 5)
/** Long enough for gestation (80–260 ticks) so births can actually register. */
const EVAL_TICKS = num('BRAIN_TICKS', 1200)
const SAMPLE_EVERY = 5
const EVAL_SEEDS = (process.env.BRAIN_SEEDS ?? '101,202')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n))

type EvalDetail = {
  score: number
  avgPop: number
  finalPop: number
  births: number
  thirstDeaths: number
  drownDeaths: number
  avgSurplus: number
}

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

function evaluateOnce(brain: BrainDNA, seed: number, settings: SimSettings): EvalDetail {
  const world = new World(seed, settings)
  world.setFounderBrainDna(brain)
  world.reset(seed, settings)

  let popSum = 0
  let samples = 0
  let surplusSum = 0
  let surplusSamples = 0
  for (let t = 0; t < EVAL_TICKS; t++) {
    world.tick()
    if (t % SAMPLE_EVERY === 0) {
      const snap = world.snapshot()
      popSum += snap.stats.herbivoreCount
      samples += 1
      for (const c of snap.creatures) {
        surplusSum += c.energy - reproduceModeThreshold(c)
        surplusSamples += 1
      }
    }
  }
  const stats = world.snapshot().stats
  const avgPop = popSum / Math.max(samples, 1)
  const finalPop = stats.herbivoreCount
  const drown = stats.deathCauseCounts.drowning ?? 0
  const thirst = stats.deathCauseCounts.thirst ?? 0
  const starve = stats.deathCauseCounts.starvation ?? 0
  const births = stats.births
  const avgSurplus = surplusSum / Math.max(surplusSamples, 1)

  // Survival first, then reproductive readiness, then actual births. Thirst is the dominant
  // observed killer — punish it at least as hard as drowning so the GA doesn't "solve" water
  // by never approaching it (which used to win when the water cue pointed into deep pond).
  const score =
    avgPop * 1.0 +
    finalPop * 0.5 +
    Math.max(0, avgSurplus) * 0.15 +
    births * 4.0 -
    thirst * 2.0 -
    starve * 1.0 -
    drown * 1.5

  return {
    score,
    avgPop,
    finalPop,
    births,
    thirstDeaths: thirst,
    drownDeaths: drown,
    avgSurplus,
  }
}

function fitness(brain: BrainDNA, settings: SimSettings): EvalDetail {
  const runs = EVAL_SEEDS.map((seed) => evaluateOnce(brain, seed, settings))
  const n = runs.length
  const avg = (pick: (d: EvalDetail) => number) => runs.reduce((s, d) => s + pick(d), 0) / n
  return {
    score: avg((d) => d.score),
    avgPop: avg((d) => d.avgPop),
    finalPop: avg((d) => d.finalPop),
    births: avg((d) => d.births),
    thirstDeaths: avg((d) => d.thirstDeaths),
    drownDeaths: avg((d) => d.drownDeaths),
    avgSurplus: avg((d) => d.avgSurplus),
  }
}

/** Seed the GA from the current baked brain so we improve it instead of rediscovering foraging. */
function initialPopulation(rng: Rng): BrainDNA[] {
  const base = seedBrainDna()
  const pop: BrainDNA[] = [cloneBrainDna(base)]
  // Heavy mutants of the seed (local search around a known-ok policy).
  while (pop.length < Math.ceil(POP * 0.7)) {
    pop.push(mutateBrainDna(cloneBrainDna(base), rng))
  }
  // A few random genomes for diversity / escape from local optima.
  while (pop.length < POP) {
    pop.push(createRandomBrainDna(rng))
  }
  return pop
}

function main(): void {
  const settings = evalSettings()
  const rng = new Rng(20260707)
  const started = Date.now()

  console.log(
    `evolveBrain: pop=${POP} gens=${GENERATIONS} ticks=${EVAL_TICKS} seeds=${EVAL_SEEDS.join(',')} (warm-start from current seed)`,
  )

  let population = initialPopulation(rng)
  let best: { brain: BrainDNA; detail: EvalDetail } | null = null

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const scored = population
      .map((brain) => ({ brain, detail: fitness(brain, settings) }))
      .sort((a, b) => b.detail.score - a.detail.score)

    if (!best || scored[0].detail.score > best.detail.score) {
      best = { brain: scored[0].brain, detail: scored[0].detail }
    }

    const mean = scored.reduce((acc, s) => acc + s.detail.score, 0) / scored.length
    const top = scored[0].detail
    const elapsedMin = ((Date.now() - started) / 60000).toFixed(1)
    console.log(
      `gen ${String(gen + 1).padStart(2)}/${GENERATIONS}  best=${top.score.toFixed(1)}  mean=${mean.toFixed(1)}  allTime=${best.detail.score.toFixed(1)}  ` +
        `pop=${top.avgPop.toFixed(1)}→${top.finalPop.toFixed(0)}  births=${top.births.toFixed(1)}  ` +
        `surplus=${top.avgSurplus.toFixed(1)}  thirst=${top.thirstDeaths.toFixed(0)}  drown=${top.drownDeaths.toFixed(0)}  (${elapsedMin}m)`,
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
  writeSeed(best.brain, best.detail.score)
  console.log(
    `\nBaked winning brain (score ${best.detail.score.toFixed(1)}, births≈${best.detail.births.toFixed(1)}) into src/sim/brain/brainSeed.ts`,
  )
  console.log(`Total time: ${((Date.now() - started) / 60000).toFixed(1)} minutes`)
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
 * baked in here so the live sim starts with creatures that already forage, hydrate, and reproduce,
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
