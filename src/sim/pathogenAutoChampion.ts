import { TICKS_PER_SECOND } from './config'
import {
  crownInHall,
  hallChampion,
  loadChampionHall,
  saveChampionHall,
  type ChampionHallEntry,
} from './championHall'
import type { Pathogen } from './disease/pathogen'
import { PathogenStrainTracker } from './pathogenLineage/pathogenStrainTracker'
import { pathogenToSavedGenome, type SavedPathogenGenome } from './pathogenDnaExport'
import type { Creature } from './types'

export const AUTO_PATHOGEN_CHAMPION_GENOME_ID = '__auto-pathogen-champion__'
export const PATHOGEN_CHAMPION_HALL_KEY = 'lifesim-champion-hall-diseases'

export const AUTO_PATHOGEN_CHAMPION_CHECK_INTERVAL = TICKS_PER_SECOND * 60

export type AutoPathogenChampionRecord = ChampionHallEntry & {
  genome: SavedPathogenGenome
  strainId: string
  infectedCount: number
  peakInfected: number
  peakStrainCount: number
  strainSpanTicks: number
  observationCount: number
}

function parsePathogenChampionEntry(raw: unknown): AutoPathogenChampionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<AutoPathogenChampionRecord>
  if (!record.genome || !Array.isArray(record.genome.genes)) return null
  return {
    entryId: String(record.entryId ?? record.strainId ?? `pathogen-strain-${Date.now()}`),
    genome: {
      ...record.genome,
      id: String(record.genome.id ?? `pathogen-genome-${Date.now()}`),
      geneCount: record.genome.genes.length,
      genes: record.genome.genes.map((g) => Number(g)),
      name: String(record.genome.name ?? 'Saved pathogen strain'),
      savedAt: String(record.genome.savedAt ?? record.savedAt ?? new Date().toISOString()),
      sourcePathogenId: Number(record.genome.sourcePathogenId ?? 0),
      generation: Number(record.genome.generation ?? 0),
    },
    fitnessScore: Number(record.fitnessScore ?? 0),
    runSeed: Number(record.runSeed ?? 0),
    runTick: Number(record.runTick ?? 0),
    savedAt: String(record.savedAt ?? new Date().toISOString()),
    strainId: String(record.strainId ?? record.entryId ?? 'pathogen-strain-unknown'),
    infectedCount: Number(record.infectedCount ?? 0),
    peakInfected: Number(record.peakInfected ?? 0),
    peakStrainCount: Number(record.peakStrainCount ?? 0),
    strainSpanTicks: Number(record.strainSpanTicks ?? 0),
    observationCount: Number(record.observationCount ?? 0),
  }
}

export function loadPathogenChampionHall(): AutoPathogenChampionRecord[] {
  return loadChampionHall(PATHOGEN_CHAMPION_HALL_KEY, parsePathogenChampionEntry)
}

export function loadAutoPathogenChampionRecord(): AutoPathogenChampionRecord | null {
  const champion = hallChampion(loadPathogenChampionHall())
  if (!champion) return null
  return {
    ...champion,
    genome: { ...champion.genome, id: AUTO_PATHOGEN_CHAMPION_GENOME_ID },
  }
}

export function buildPathogenStrainChampionRecord(
  representative: Pathogen,
  fitnessScore: number,
  runSeed: number,
  runTick: number,
  strain: {
    id: string
    infectedCount: number
    peakInfected: number
    peakStrainCount: number
    spanTicks: number
    observationCount: number
  },
): AutoPathogenChampionRecord {
  const genome = pathogenToSavedGenome(
    representative,
    `Pathogen · peak ${strain.peakInfected} infected · #${representative.id}`,
  )

  return {
    entryId: strain.id,
    genome,
    fitnessScore,
    runSeed,
    runTick,
    savedAt: new Date().toISOString(),
    strainId: strain.id,
    infectedCount: strain.infectedCount,
    peakInfected: strain.peakInfected,
    peakStrainCount: strain.peakStrainCount,
    strainSpanTicks: strain.spanTicks,
    observationCount: strain.observationCount,
  }
}

export function tryUpdateAutoPathogenChampion(
  tracker: PathogenStrainTracker,
  pathogens: readonly Pathogen[],
  creatures: readonly Creature[],
  runSeed: number,
  runTick: number,
): { champion: AutoPathogenChampionRecord | null; hall: AutoPathogenChampionRecord[]; crowned: boolean } {
  const hall = loadPathogenChampionHall()
  const bestStrain = tracker.observe(pathogens, creatures, runTick)
  if (!bestStrain?.bestRepresentative) {
    return { champion: loadAutoPathogenChampionRecord(), hall, crowned: false }
  }

  const candidate = buildPathogenStrainChampionRecord(
    bestStrain.bestRepresentative,
    tracker.fitnessOf(bestStrain),
    runSeed,
    runTick,
    {
      id: bestStrain.id,
      infectedCount: bestStrain.lastInfected,
      peakInfected: bestStrain.peakInfected,
      peakStrainCount: bestStrain.peakStrainCount,
      spanTicks: bestStrain.lastSeenTick - bestStrain.firstSeenTick,
      observationCount: bestStrain.observationCount,
    },
  )

  const { hall: nextHall, crowned } = crownInHall(hall, candidate)
  if (crowned) {
    saveChampionHall(PATHOGEN_CHAMPION_HALL_KEY, nextHall)
  }

  return {
    champion: loadAutoPathogenChampionRecord(),
    hall: crowned ? nextHall : hall,
    crowned,
  }
}
