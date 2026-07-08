/**
 * Headless A/B: run the same world with the evolved brain on vs the legacy goal-seeking AI, and
 * report survival, reproduction, and drowning. Used to check that the baked seed actually helps
 * (fewer drownings, healthy population). Run with: npm run compare:brains
 */
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

type SimSettings = typeof DEFAULT_SIM_SETTINGS

const TICKS = Number(process.env.CMP_TICKS ?? 3000)
const SEEDS = (process.env.CMP_SEEDS ?? '7,42,99').split(',').map((s) => Number(s.trim()))

function settings(brainControlEnabled: boolean): SimSettings {
  // Use the real, balanced game defaults; only spawn immediately and toggle the brain.
  return {
    ...DEFAULT_SIM_SETTINGS,
    creatureFirstSpawnDelayYears: 0,
    brainControlEnabled,
  }
}

type Result = { avgPop: number; finalPop: number; births: number; deaths: number; drowned: number }

function run(brain: boolean, seed: number): Result {
  const s = settings(brain)
  const world = new World(seed, s)
  world.reset(seed, s)
  let popSum = 0
  let samples = 0
  for (let t = 0; t < TICKS; t++) {
    world.tick()
    if (t % 10 === 0) {
      popSum += world.snapshot().stats.herbivoreCount
      samples += 1
    }
  }
  const stats = world.snapshot().stats
  return {
    avgPop: popSum / Math.max(samples, 1),
    finalPop: stats.herbivoreCount,
    births: stats.births,
    deaths: stats.deaths,
    drowned: stats.deathCauseCounts.drowning ?? 0,
  }
}

function summarize(label: string, results: Result[]): void {
  const n = results.length
  const avg = (pick: (r: Result) => number) => results.reduce((a, r) => a + pick(r), 0) / n
  const avgPop = avg((r) => r.avgPop)
  const finalPop = avg((r) => r.finalPop)
  const births = avg((r) => r.births)
  const deaths = avg((r) => r.deaths)
  const drowned = avg((r) => r.drowned)
  const drownShare = deaths > 0 ? (drowned / deaths) * 100 : 0
  console.log(
    `${label.padEnd(12)} avgPop=${avgPop.toFixed(1)}  finalPop=${finalPop.toFixed(1)}  births=${births.toFixed(0)}  deaths=${deaths.toFixed(0)}  drowned=${drowned.toFixed(0)} (${drownShare.toFixed(1)}% of deaths)`,
  )
}

console.log(`Comparing over ${SEEDS.length} seed(s), ${TICKS} ticks each...\n`)
const brainResults = SEEDS.map((seed) => run(true, seed))
const legacyResults = SEEDS.map((seed) => run(false, seed))
summarize('brain', brainResults)
summarize('legacy', legacyResults)
