import { TICKS_PER_SECOND } from './config'
import { creatureToSavedGenome, type SavedGenome } from './dnaExport'
import { LineageTracker } from './lineage/lineageTracker'
import type { Creature } from './types'

export const AUTO_CHAMPION_GENOME_ID = '__auto-champion__'
/** How often lineage fitness is sampled (once per real-time minute at 30 tps). */
export const AUTO_CHAMPION_CHECK_INTERVAL = TICKS_PER_SECOND * 60

export type AutoChampionRecord = {
  genome: SavedGenome
  fitnessScore: number
  runSeed: number
  runTick: number
  savedAt: string
  lineageId: string
  population: number
  peakPopulation: number
  lineageSpanTicks: number
  observationCount: number
}

const STORAGE_KEY = 'lifesim-auto-champion'

export function loadAutoChampionRecord(): AutoChampionRecord | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const raw = JSON.parse(stored) as Partial<AutoChampionRecord>
    if (!raw.genome || !Array.isArray(raw.genome.genes)) return null
    return {
      genome: {
        ...raw.genome,
        id: AUTO_CHAMPION_GENOME_ID,
        geneCount: raw.genome.genes.length,
        genes: raw.genome.genes.map((g) => Number(g)),
        name: String(raw.genome.name ?? 'All-time lineage'),
        savedAt: String(raw.genome.savedAt ?? raw.savedAt ?? new Date().toISOString()),
        sex: raw.genome.sex === 'female' ? 'female' : 'male',
        sourceCreatureId: Number(raw.genome.sourceCreatureId ?? 0),
        ageTicks: Number(raw.genome.ageTicks ?? 0),
        energy: Number(raw.genome.energy ?? 0),
      },
      fitnessScore: Number(raw.fitnessScore ?? 0),
      runSeed: Number(raw.runSeed ?? 0),
      runTick: Number(raw.runTick ?? 0),
      savedAt: String(raw.savedAt ?? new Date().toISOString()),
      lineageId: String(raw.lineageId ?? 'lineage-unknown'),
      population: Number(raw.population ?? 0),
      peakPopulation: Number(raw.peakPopulation ?? 0),
      lineageSpanTicks: Number(raw.lineageSpanTicks ?? 0),
      observationCount: Number(raw.observationCount ?? 0),
    }
  } catch {
    return null
  }
}

function saveAutoChampionRecord(record: AutoChampionRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // ignore quota / private mode errors
  }
}

export function buildLineageChampionRecord(
  representative: Creature,
  fitnessScore: number,
  runSeed: number,
  runTick: number,
  lineage: {
    id: string
    population: number
    peakPopulation: number
    spanTicks: number
    observationCount: number
  },
): AutoChampionRecord {
  const genome = creatureToSavedGenome(
    representative,
    `Lineage · peak ${lineage.peakPopulation} · #${representative.id}`,
  )
  genome.id = AUTO_CHAMPION_GENOME_ID

  return {
    genome,
    fitnessScore,
    runSeed,
    runTick,
    savedAt: new Date().toISOString(),
    lineageId: lineage.id,
    population: lineage.population,
    peakPopulation: lineage.peakPopulation,
    lineageSpanTicks: lineage.spanTicks,
    observationCount: lineage.observationCount,
  }
}

/** Track lineages over time; persist the all-time best *group*, not a lone individual. */
export function tryUpdateAutoChampion(
  tracker: LineageTracker,
  creatures: readonly Creature[],
  runSeed: number,
  runTick: number,
): AutoChampionRecord | null {
  const bestLineage = tracker.observe(creatures, runTick)
  if (!bestLineage?.bestRepresentative) {
    return loadAutoChampionRecord()
  }

  const fitness = tracker.fitnessOf(bestLineage)
  const stored = loadAutoChampionRecord()
  if (stored && fitness <= stored.fitnessScore) {
    return stored
  }

  const record = buildLineageChampionRecord(
    bestLineage.bestRepresentative,
    fitness,
    runSeed,
    runTick,
    {
      id: bestLineage.id,
      population: bestLineage.lastPopulation,
      peakPopulation: bestLineage.peakPopulation,
      spanTicks: bestLineage.lastSeenTick - bestLineage.firstSeenTick,
      observationCount: bestLineage.observationCount,
    },
  )
  saveAutoChampionRecord(record)
  return record
}
