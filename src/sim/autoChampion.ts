import { TICKS_PER_SECOND } from './config'
import {
  crownInHall,
  hallChampion,
  loadChampionHall,
  saveChampionHall,
  type ChampionHallEntry,
} from './championHall'
import { creatureToSavedGenome, type SavedGenome } from './dnaExport'
import { LineageTracker } from './lineage/lineageTracker'
import type { Creature } from './types'

export const AUTO_CHAMPION_GENOME_ID = '__auto-champion__'
export const CREATURE_CHAMPION_HALL_KEY = 'lifesim-champion-hall-creatures'
const LEGACY_CHAMPION_KEY = 'lifesim-auto-champion'

/** How often lineage fitness is sampled (once per real-time minute at 30 tps). */
export const AUTO_CHAMPION_CHECK_INTERVAL = TICKS_PER_SECOND * 60

export type AutoChampionRecord = ChampionHallEntry & {
  genome: SavedGenome
  lineageId: string
  population: number
  peakPopulation: number
  lineageSpanTicks: number
  observationCount: number
}

function parseCreatureChampionEntry(raw: unknown): AutoChampionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<AutoChampionRecord>
  if (!record.genome || !Array.isArray(record.genome.genes)) return null
  return {
    entryId: String(record.entryId ?? record.lineageId ?? `lineage-${Date.now()}`),
    genome: {
      ...record.genome,
      id: String(record.genome.id ?? `genome-${Date.now()}`),
      geneCount: record.genome.genes.length,
      genes: record.genome.genes.map((g) => Number(g)),
      name: String(record.genome.name ?? 'Saved lineage'),
      savedAt: String(record.genome.savedAt ?? record.savedAt ?? new Date().toISOString()),
      sex: record.genome.sex === 'female' ? 'female' : 'male',
      sourceCreatureId: Number(record.genome.sourceCreatureId ?? 0),
      ageTicks: Number(record.genome.ageTicks ?? 0),
      energy: Number(record.genome.energy ?? 0),
    },
    fitnessScore: Number(record.fitnessScore ?? 0),
    runSeed: Number(record.runSeed ?? 0),
    runTick: Number(record.runTick ?? 0),
    savedAt: String(record.savedAt ?? new Date().toISOString()),
    lineageId: String(record.lineageId ?? record.entryId ?? 'lineage-unknown'),
    population: Number(record.population ?? 0),
    peakPopulation: Number(record.peakPopulation ?? 0),
    lineageSpanTicks: Number(record.lineageSpanTicks ?? 0),
    observationCount: Number(record.observationCount ?? 0),
  }
}

function parseLegacyCreatureChampion(raw: unknown): AutoChampionRecord | null {
  const entry = parseCreatureChampionEntry(raw)
  if (!entry) return null
  entry.genome.id = AUTO_CHAMPION_GENOME_ID
  entry.entryId = entry.lineageId
  return entry
}

export function loadCreatureChampionHall(): AutoChampionRecord[] {
  return loadChampionHall(
    CREATURE_CHAMPION_HALL_KEY,
    parseCreatureChampionEntry,
    LEGACY_CHAMPION_KEY,
    parseLegacyCreatureChampion,
  )
}

export function loadAutoChampionRecord(): AutoChampionRecord | null {
  const champion = hallChampion(loadCreatureChampionHall())
  if (!champion) return null
  return {
    ...champion,
    genome: { ...champion.genome, id: AUTO_CHAMPION_GENOME_ID },
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

  return {
    entryId: lineage.id,
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
): { champion: AutoChampionRecord | null; hall: AutoChampionRecord[]; crowned: boolean } {
  const hall = loadCreatureChampionHall()
  const bestLineage = tracker.observe(creatures, runTick)
  if (!bestLineage?.bestRepresentative) {
    const champion = loadAutoChampionRecord()
    return { champion, hall, crowned: false }
  }

  const candidate = buildLineageChampionRecord(
    bestLineage.bestRepresentative,
    tracker.fitnessOf(bestLineage),
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

  const { hall: nextHall, crowned } = crownInHall(hall, candidate)
  if (crowned) {
    saveChampionHall(CREATURE_CHAMPION_HALL_KEY, nextHall)
  }

  const champion = loadAutoChampionRecord()
  return { champion, hall: crowned ? nextHall : hall, crowned }
}
