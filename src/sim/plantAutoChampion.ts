import { TICKS_PER_SECOND } from './config'
import {
  crownInHall,
  hallChampion,
  loadChampionHall,
  saveChampionHall,
  type ChampionHallEntry,
} from './championHall'
import { PlantSpeciesTracker } from './plantLineage/plantSpeciesTracker'
import { plantToSavedGenome, type SavedPlantGenome } from './plantDnaExport'
import type { Plant } from './types'

export const AUTO_PLANT_CHAMPION_GENOME_ID = '__auto-plant-champion__'
export const PLANT_CHAMPION_HALL_KEY = 'lifesim-champion-hall-plants'
const LEGACY_PLANT_CHAMPION_KEY = 'lifesim-auto-plant-champion'

export const AUTO_PLANT_CHAMPION_CHECK_INTERVAL = TICKS_PER_SECOND * 60

export type AutoPlantChampionRecord = ChampionHallEntry & {
  genome: SavedPlantGenome
  speciesId: string
  population: number
  peakPopulation: number
  peakBiomass: number
  speciesSpanTicks: number
  observationCount: number
}

function parsePlantChampionEntry(raw: unknown): AutoPlantChampionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<AutoPlantChampionRecord>
  if (!record.genome || !Array.isArray(record.genome.genes)) return null
  return {
    entryId: String(record.entryId ?? record.speciesId ?? `plant-species-${Date.now()}`),
    genome: {
      ...record.genome,
      id: String(record.genome.id ?? `plant-genome-${Date.now()}`),
      geneCount: record.genome.genes.length,
      genes: record.genome.genes.map((g) => Number(g)),
      name: String(record.genome.name ?? 'Saved plant species'),
      savedAt: String(record.genome.savedAt ?? record.savedAt ?? new Date().toISOString()),
      sourcePlantId: Number(record.genome.sourcePlantId ?? 0),
      ageTicks: Number(record.genome.ageTicks ?? 0),
      energy: Number(record.genome.energy ?? 0),
    },
    fitnessScore: Number(record.fitnessScore ?? 0),
    runSeed: Number(record.runSeed ?? 0),
    runTick: Number(record.runTick ?? 0),
    savedAt: String(record.savedAt ?? new Date().toISOString()),
    speciesId: String(record.speciesId ?? record.entryId ?? 'plant-species-unknown'),
    population: Number(record.population ?? 0),
    peakPopulation: Number(record.peakPopulation ?? 0),
    peakBiomass: Number(record.peakBiomass ?? 0),
    speciesSpanTicks: Number(record.speciesSpanTicks ?? 0),
    observationCount: Number(record.observationCount ?? 0),
  }
}

function parseLegacyPlantChampion(raw: unknown): AutoPlantChampionRecord | null {
  const entry = parsePlantChampionEntry(raw)
  if (!entry) return null
  entry.genome.id = AUTO_PLANT_CHAMPION_GENOME_ID
  entry.entryId = entry.speciesId
  return entry
}

export function loadPlantChampionHall(): AutoPlantChampionRecord[] {
  return loadChampionHall(
    PLANT_CHAMPION_HALL_KEY,
    parsePlantChampionEntry,
    LEGACY_PLANT_CHAMPION_KEY,
    parseLegacyPlantChampion,
  )
}

export function loadAutoPlantChampionRecord(): AutoPlantChampionRecord | null {
  const champion = hallChampion(loadPlantChampionHall())
  if (!champion) return null
  return {
    ...champion,
    genome: { ...champion.genome, id: AUTO_PLANT_CHAMPION_GENOME_ID },
  }
}

export function buildPlantSpeciesChampionRecord(
  representative: Plant,
  fitnessScore: number,
  runSeed: number,
  runTick: number,
  species: {
    id: string
    population: number
    peakPopulation: number
    peakBiomass: number
    spanTicks: number
    observationCount: number
  },
): AutoPlantChampionRecord {
  const genome = plantToSavedGenome(
    representative,
    `Plant species · peak ${species.peakPopulation} · #${representative.id}`,
  )

  return {
    entryId: species.id,
    genome,
    fitnessScore,
    runSeed,
    runTick,
    savedAt: new Date().toISOString(),
    speciesId: species.id,
    population: species.population,
    peakPopulation: species.peakPopulation,
    peakBiomass: species.peakBiomass,
    speciesSpanTicks: species.spanTicks,
    observationCount: species.observationCount,
  }
}

export function tryUpdateAutoPlantChampion(
  tracker: PlantSpeciesTracker,
  plants: readonly Plant[],
  runSeed: number,
  runTick: number,
): { champion: AutoPlantChampionRecord | null; hall: AutoPlantChampionRecord[]; crowned: boolean } {
  const hall = loadPlantChampionHall()
  const bestSpecies = tracker.observe(plants, runTick)
  if (!bestSpecies?.bestRepresentative) {
    return { champion: loadAutoPlantChampionRecord(), hall, crowned: false }
  }

  const candidate = buildPlantSpeciesChampionRecord(
    bestSpecies.bestRepresentative,
    tracker.fitnessOf(bestSpecies),
    runSeed,
    runTick,
    {
      id: bestSpecies.id,
      population: bestSpecies.lastPopulation,
      peakPopulation: bestSpecies.peakPopulation,
      peakBiomass: bestSpecies.peakBiomass,
      spanTicks: bestSpecies.lastSeenTick - bestSpecies.firstSeenTick,
      observationCount: bestSpecies.observationCount,
    },
  )

  const { hall: nextHall, crowned } = crownInHall(hall, candidate)
  if (crowned) {
    saveChampionHall(PLANT_CHAMPION_HALL_KEY, nextHall)
  }

  return {
    champion: loadAutoPlantChampionRecord(),
    hall: crowned ? nextHall : hall,
    crowned,
  }
}
