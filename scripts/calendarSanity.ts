/**
 * Headless calendar / biology sanity check after the 1-tick=1-minute rebalance.
 * Run: npx tsx scripts/calendarSanity.ts
 *
 * Env: SANITY_DAYS=3 (sim days to simulate)
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
const { TICKS_PER_DAY, TICKS_PER_YEAR, formatYears, yearsToTicks } = await import(
  '../src/sim/timeScale.ts'
)
const { expressHerbivore } = await import('../src/sim/phenotype.ts')
const { createRandomHerbivoreDNA } = await import('../src/sim/herbivoreBudget.ts')
const { Rng } = await import('../src/sim/rng.ts')
const { DAY_LENGTH_SECONDS, DAYS_PER_SEASON_YEAR, MINUTES_PER_TICK } = await import(
  '../src/sim/config.ts'
)

const DAYS = Number(process.env.SANITY_DAYS ?? 3)
const TICKS = DAYS * TICKS_PER_DAY

console.log('Calendar backbone')
console.log(
  `  MINUTES_PER_TICK=${MINUTES_PER_TICK} TICKS_PER_DAY=${TICKS_PER_DAY} TICKS_PER_YEAR=${TICKS_PER_YEAR}`,
)
console.log(`  DAY_LENGTH_SECONDS=${DAY_LENGTH_SECONDS} DAYS_PER_SEASON_YEAR=${DAYS_PER_SEASON_YEAR}`)
console.log(
  `  yearsToTicks(1)=${yearsToTicks(1)} formatYears(TICKS_PER_DAY)=${formatYears(TICKS_PER_DAY)}`,
)

const sample = expressHerbivore(createRandomHerbivoreDNA(new Rng(7)))
console.log('Sample creature durations')
console.log(
  `  maturation=${formatYears(sample.maturationAge)} gestation=${formatYears(sample.pregnancyTicks)}`,
)
console.log(
  `  cooldown=${formatYears(sample.reproCooldown)} vigorPrime=${formatYears(sample.maxAge)}`,
)
console.log(`  modeCommitment=${formatYears(sample.modeCommitment)}`)

const world = new World(42, {
  ...DEFAULT_SIM_SETTINGS,
  worldWidth: 1100,
  worldHeight: 800,
  creatureGroups: 1,
  herbivoresPerGroup: 28,
  creatureFirstSpawnDelayYears: 0,
  creatureGroupSpawnIntervalYears: 0.03,
  initialPlants: 180,
  brainControlEnabled: true,
  respawnBestPlantSpecies: false,
  respawnBestPathogen: false,
  pathogenChampionSpawnChance: 0,
  groupFounders: DEFAULT_SIM_SETTINGS.groupFounders.map(() => ''),
})

let peakPop = 0
let minPop = Infinity
for (let t = 0; t < TICKS; t++) {
  world.tick()
  const pop = world.snapshot().stats.herbivoreCount
  peakPop = Math.max(peakPop, pop)
  minPop = Math.min(minPop, pop)
}

const stats = world.snapshot().stats
const deaths = stats.deathCauseCounts
const drift = Math.abs(stats.totalWater - stats.totalWaterBudget)

console.log(`Ran ${DAYS} sim-days (${TICKS} ticks)`)
console.log(`  pop final=${stats.herbivoreCount} peak=${peakPop} min=${minPop}`)
console.log(`  births=${stats.births} deaths=${stats.deaths}`)
console.log(`  death causes:`, { ...deaths })
console.log(
  `  water total=${stats.totalWater.toFixed(1)} budget=${stats.totalWaterBudget.toFixed(1)} drift=${drift.toFixed(2)}`,
)

if (deaths.oldAge > 0) {
  console.error('FAIL: oldAge deaths should be impossible for creatures')
  process.exit(1)
}
if (stats.herbivoreCount === 0) {
  console.error('FAIL: population extinct within sanity window')
  process.exit(1)
}
if (drift > 25) {
  console.error(`FAIL: water budget drift too high (${drift.toFixed(2)})`)
  process.exit(1)
}

console.log('PASS: no oldAge deaths; population surviving; water budget closed')
if (stats.births === 0) {
  console.log(
    `NOTE: no births in ${DAYS} days (maturation is weeks); extend with SANITY_DAYS=25 if needed`,
  )
}
